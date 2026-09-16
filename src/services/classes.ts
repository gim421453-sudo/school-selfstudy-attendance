import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { makeClassId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { ClassRoom, ScopedClassRoom, StaffAssignment } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { listAssignmentsForGrade } from "./staffAssignments";

export function listClasses(): Promise<ClassRoom[]>;
export function listClasses(academicYearId: string, gradeId: string): Promise<ScopedClassRoom[]>;
export async function listClasses(academicYearId?: string, gradeId?: string): Promise<ClassRoom[]> {
  const scoped = academicYearId !== undefined || gradeId !== undefined;
  if (scoped && (!academicYearId || !gradeId)) throw new Error("Academic year and grade are required.");
  const snapshot = scoped
    ? await getDocs(query(collection(db, "classes"), where("academicYearId", "==", academicYearId), where("gradeId", "==", gradeId), orderBy("classNumber")))
    : await getDocs(query(collection(db, "classes"), orderBy("grade"), orderBy("classNo")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ClassRoom, "id">) }));
}

export async function getClass(classId: string): Promise<ClassRoom | null> {
  const snapshot = await getDoc(doc(db, "classes", classId));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<ClassRoom, "id">) } : null;
}

function requireScopedClass(classRoom: ClassRoom | null): ScopedClassRoom {
  if (!classRoom?.academicYearId || !classRoom.gradeId || !classRoom.classNumber) throw new Error("This class is not a scoped class record.");
  return classRoom as ScopedClassRoom;
}

function validateScopedClass(value: Omit<ScopedClassRoom, "id"> | ScopedClassRoom) {
  if (!value.academicYearId.trim() || !value.gradeId.trim()) throw new Error("Academic year and grade are required.");
  if (!Number.isInteger(value.classNumber) || value.classNumber < 1) throw new Error("Class number must be a positive integer.");
  if (!value.displayName.trim()) throw new Error("Class display name is required.");
}

export async function createClass(value: Omit<ScopedClassRoom, "id">, actor: AuditActor): Promise<string> {
  validateScopedClass(value);
  const existing = await listClasses(value.academicYearId, value.gradeId);
  if (existing.some((classRoom) => classRoom.classNumber === value.classNumber)) throw new Error("A class with this number already exists in the selected scope.");
  const id = makeClassId(value.academicYearId, value.gradeId, value.classNumber);
  const next = { ...value, displayName: value.displayName.trim(), homeroomTeacherUid: null, homeroomTeacherName: null };
  const batch = writeBatch(db);
  batch.set(doc(db, "classes", id), next);
  appendAuditLog(batch, { actor, action: "CLASS_CREATED", targetType: "class", targetId: id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, classId: id });
  await batch.commit();
  return id;
}

export async function updateClass(value: ScopedClassRoom, actor: AuditActor, before: ScopedClassRoom) {
  validateScopedClass(value);
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeId !== before.gradeId || value.classNumber !== before.classNumber) throw new Error("Class identity and scope cannot change.");
  const next = { displayName: value.displayName.trim(), active: value.active, updatedAt: serverTimestamp() };
  const action = !before.active && value.active ? "CLASS_ACTIVATED" : before.active && !value.active ? "CLASS_DEACTIVATED" : "CLASS_UPDATED";
  const batch = writeBatch(db);
  batch.update(doc(db, "classes", value.id), next);
  appendAuditLog(batch, { actor, action, targetType: "class", targetId: value.id, before, after: { ...before, ...next }, academicYearId: value.academicYearId, gradeId: value.gradeId, classId: value.id });
  await batch.commit();
}

export async function setClassActive(classRoom: ScopedClassRoom, active: boolean, actor: AuditActor) {
  if (classRoom.active === active) return;
  await updateClass({ ...classRoom, active }, actor, classRoom);
}

export interface HomeroomCandidate { uid: string; displayName: string; conflictClassId?: string; conflictClassName?: string; }
interface HomeroomLock { academicYearId: string; gradeId: string; uid: string; classId: string; classDisplayName?: string; updatedAt?: unknown; }

function homeroomLockId(academicYearId: string, uid: string) { return `${academicYearId}_${uid}`; }

async function getHomeroomLock(academicYearId: string, uid: string): Promise<HomeroomLock | null> {
  const snapshot = await getDoc(doc(db, "homeroomAssignments", homeroomLockId(academicYearId, uid)));
  return snapshot.exists() ? snapshot.data() as HomeroomLock : null;
}

export function buildHomeroomCandidates(assignments: StaffAssignment[], locks: Array<HomeroomLock | null>): HomeroomCandidate[] {
  return assignments.filter((assignment) => assignment.active).map((assignment, index) => {
    const lock = locks[index];
    return { uid: assignment.uid, displayName: assignment.displayName ?? "이름 정보 없음", ...(lock?.classId ? { conflictClassId: lock.classId, conflictClassName: lock.classDisplayName ?? "다른 반" } : {}) };
  });
}

export async function listEligibleHomeroomTeachers(academicYearId: string, gradeId: string): Promise<HomeroomCandidate[]> {
  const assignments = (await listAssignmentsForGrade(academicYearId, gradeId)).filter((assignment) => assignment.active);
  const locks = await Promise.all(assignments.map((assignment) => getHomeroomLock(academicYearId, assignment.uid)));
  return buildHomeroomCandidates(assignments, locks);
}

async function updateHomeroomTeacher(classId: string, teacherUid: string | null, actor: AuditActor, action: "HOMEROOM_ASSIGNED" | "HOMEROOM_CHANGED" | "HOMEROOM_REMOVED") {
  const classRoom = requireScopedClass(await getClass(classId));
  const before = { teacherUid: classRoom.homeroomTeacherUid ?? null, teacherName: classRoom.homeroomTeacherName ?? null };
  const batch = writeBatch(db);
  if (teacherUid) {
    const candidate = (await listEligibleHomeroomTeachers(classRoom.academicYearId, classRoom.gradeId)).find((item) => item.uid === teacherUid);
    if (!candidate) throw new Error("Only an active teacher assigned to this academic year and grade can be homeroom teacher.");
    if (candidate.conflictClassId && candidate.conflictClassId !== classId) throw new Error(`Already assigned as homeroom teacher for ${candidate.conflictClassName ?? "another class"}.`);
    batch.update(doc(db, "classes", classId), { homeroomTeacherUid: candidate.uid, homeroomTeacherName: candidate.displayName, updatedAt: serverTimestamp() });
    batch.set(doc(db, "homeroomAssignments", homeroomLockId(classRoom.academicYearId, candidate.uid)), { academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, uid: candidate.uid, classId, classDisplayName: classRoom.displayName, updatedAt: serverTimestamp() });
    if (before.teacherUid && before.teacherUid !== candidate.uid) batch.delete(doc(db, "homeroomAssignments", homeroomLockId(classRoom.academicYearId, before.teacherUid)));
    appendAuditLog(batch, { actor, action, targetType: "class", targetId: classId, before, after: { teacherUid: candidate.uid, teacherName: candidate.displayName }, academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, classId });
  } else {
    batch.update(doc(db, "classes", classId), { homeroomTeacherUid: null, homeroomTeacherName: null, updatedAt: serverTimestamp() });
    if (before.teacherUid) batch.delete(doc(db, "homeroomAssignments", homeroomLockId(classRoom.academicYearId, before.teacherUid)));
    appendAuditLog(batch, { actor, action, targetType: "class", targetId: classId, before, after: { teacherUid: null, teacherName: null }, academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, classId });
  }
  await batch.commit();
}

export async function assignHomeroomTeacher(classId: string, teacherUid: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (classRoom.homeroomTeacherUid) throw new Error("A homeroom teacher is already assigned.");
  await updateHomeroomTeacher(classId, teacherUid, actor, "HOMEROOM_ASSIGNED");
}

export async function changeHomeroomTeacher(classId: string, teacherUid: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (!classRoom.homeroomTeacherUid) throw new Error("No homeroom teacher is assigned.");
  await updateHomeroomTeacher(classId, teacherUid, actor, "HOMEROOM_CHANGED");
}

export async function removeHomeroomTeacher(classId: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (!classRoom.homeroomTeacherUid) return;
  await updateHomeroomTeacher(classId, null, actor, "HOMEROOM_REMOVED");
}
