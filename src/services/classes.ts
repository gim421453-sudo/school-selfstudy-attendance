import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AppUser, ClassRoom, ScopedClassRoom, UserRole } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getAppUser } from "./users";
import { listAssignmentsForGrade } from "./staffAssignments";

export function listClasses(): Promise<ClassRoom[]>;
export function listClasses(academicYearId: string, gradeId: string): Promise<ScopedClassRoom[]>;
export async function listClasses(academicYearId?: string, gradeId?: string): Promise<ClassRoom[]> {
  const scoped = academicYearId !== undefined || gradeId !== undefined;
  if (scoped && (!academicYearId || !gradeId)) throw new Error("학년도와 학년을 모두 지정해 주세요.");
  const snap = scoped
    ? await getDocs(query(collection(db, "classes"), where("academicYearId", "==", academicYearId), where("gradeId", "==", gradeId), orderBy("classNumber")))
    : await getDocs(query(collection(db, "classes"), orderBy("grade"), orderBy("classNo")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClassRoom, "id">) }));
}

export async function getClass(classId: string): Promise<ClassRoom | null> {
  const snapshot = await getDoc(doc(db, "classes", classId));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<ClassRoom, "id">) } : null;
}

function requireScopedClass(classRoom: ClassRoom | null): ScopedClassRoom {
  if (!classRoom?.academicYearId || !classRoom.gradeId || !classRoom.classNumber) {
    throw new Error("선택한 반은 scoped 학년도/학년 데이터가 아닙니다.");
  }
  return classRoom as ScopedClassRoom;
}

function validateScopedClass(value: Omit<ScopedClassRoom, "id"> | ScopedClassRoom) {
  if (!value.academicYearId.trim() || !value.gradeId.trim()) throw new Error("학년도와 학년을 지정해 주세요.");
  if (!Number.isInteger(value.classNumber) || value.classNumber < 1) throw new Error("반 번호는 1 이상의 정수여야 합니다.");
  if (!value.displayName.trim()) throw new Error("반 표시명을 입력해 주세요.");
}

export async function createClass(value: Omit<ScopedClassRoom, "id">, actor: AuditActor): Promise<string> {
  validateScopedClass(value);
  const existing = await listClasses(value.academicYearId, value.gradeId);
  if (existing.some((classRoom) => classRoom.classNumber === value.classNumber)) throw new Error("같은 학년에 이미 존재하는 반 번호입니다.");
  const ref = doc(collection(db, "classes"));
  const next = { ...value, displayName: value.displayName.trim(), homeroomTeacherUid: value.homeroomTeacherUid ?? null, homeroomTeacherName: value.homeroomTeacherName ?? null };
  const batch = writeBatch(db);
  batch.set(ref, next);
  appendAuditLog(batch, { actor, action: "CLASS_CREATED", targetType: "class", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, classId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function updateClass(value: ScopedClassRoom, actor: AuditActor, before: ScopedClassRoom) {
  validateScopedClass(value);
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeId !== before.gradeId || value.classNumber !== before.classNumber) {
    throw new Error("반의 ID, 학년도, 학년, 반 번호는 이 service에서 변경할 수 없습니다.");
  }
  const next = { displayName: value.displayName.trim(), active: value.active };
  const batch = writeBatch(db);
  batch.update(doc(db, "classes", value.id), next);
  appendAuditLog(batch, { actor, action: "CLASS_UPDATED", targetType: "class", targetId: value.id, before, after: { ...before, ...next }, academicYearId: value.academicYearId, gradeId: value.gradeId, classId: value.id });
  await batch.commit();
}

export async function deactivateClass(classId: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (!classRoom.active) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "classes", classId), { active: false });
  appendAuditLog(batch, { actor, action: "CLASS_DEACTIVATED", targetType: "class", targetId: classId, before: classRoom, after: { ...classRoom, active: false }, academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, classId });
  await batch.commit();
}

export interface HomeroomCandidate {
  user: AppUser;
  conflictClassId?: string;
  conflictClassName?: string;
}

async function listScopedClassesForYear(academicYearId: string): Promise<ScopedClassRoom[]> {
  const snapshot = await getDocs(query(collection(db, "classes"), where("academicYearId", "==", academicYearId), orderBy("gradeId"), orderBy("classNumber")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ScopedClassRoom, "id">) }));
}

export async function listEligibleHomeroomTeachers(academicYearId: string, gradeId: string): Promise<HomeroomCandidate[]> {
  const [assignments, annualClasses] = await Promise.all([
    listAssignmentsForGrade(academicYearId, gradeId),
    listScopedClassesForYear(academicYearId),
  ]);
  const eligible = assignments.filter((assignment) => assignment.active);
  const users = await Promise.all(eligible.map((assignment) => getAppUser(assignment.uid)));
  return users.flatMap((user) => {
    if (!user?.active) return [];
    const conflict = annualClasses.find((classRoom) => classRoom.homeroomTeacherUid === user.uid);
    return [{ user, ...(conflict ? { conflictClassId: conflict.id, conflictClassName: conflict.displayName } : {}) }];
  });
}

async function updateHomeroomTeacher(classId: string, teacherUid: string | null, actor: AuditActor, action: "HOMEROOM_ASSIGNED" | "HOMEROOM_CHANGED" | "HOMEROOM_REMOVED") {
  const classRoom = requireScopedClass(await getClass(classId));
  const before = { teacherUid: classRoom.homeroomTeacherUid ?? null, teacherName: classRoom.homeroomTeacherName ?? null };
  if (teacherUid) {
    const candidates = await listEligibleHomeroomTeachers(classRoom.academicYearId, classRoom.gradeId);
    const candidate = candidates.find((item) => item.user.uid === teacherUid);
    if (!candidate) throw new Error("해당 학년도와 학년에 배정된 활성 교직원만 담임으로 지정할 수 있습니다.");
    if (candidate.conflictClassId && candidate.conflictClassId !== classId) throw new Error("해당 교직원은 이미 현 학년도의 다른 반 담임입니다.");
    const batch = writeBatch(db);
    batch.update(doc(db, "classes", classId), { homeroomTeacherUid: candidate.user.uid, homeroomTeacherName: candidate.user.displayName, updatedAt: serverTimestamp() });
    appendAuditLog(batch, { actor, action, targetType: "class", targetId: classId, before, after: { teacherUid: candidate.user.uid, teacherName: candidate.user.displayName }, academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, classId });
    await batch.commit();
    return;
  }
  const batch = writeBatch(db);
  batch.update(doc(db, "classes", classId), { homeroomTeacherUid: null, homeroomTeacherName: null, updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action, targetType: "class", targetId: classId, before, after: { teacherUid: null, teacherName: null }, academicYearId: classRoom.academicYearId, gradeId: classRoom.gradeId, classId });
  await batch.commit();
}

export async function assignHomeroomTeacher(classId: string, teacherUid: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (classRoom.homeroomTeacherUid) throw new Error("이미 담임이 지정된 반입니다.");
  await updateHomeroomTeacher(classId, teacherUid, actor, "HOMEROOM_ASSIGNED");
}

export async function changeHomeroomTeacher(classId: string, teacherUid: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (!classRoom.homeroomTeacherUid) throw new Error("변경할 담임이 없습니다.");
  await updateHomeroomTeacher(classId, teacherUid, actor, "HOMEROOM_CHANGED");
}

export async function removeHomeroomTeacher(classId: string, actor: AuditActor) {
  const classRoom = requireScopedClass(await getClass(classId));
  if (!classRoom.homeroomTeacherUid) return;
  await updateHomeroomTeacher(classId, null, actor, "HOMEROOM_REMOVED");
}

export async function saveClassRoom(value: ClassRoom, actor: AuditActor, before?: ClassRoom | null) {
  const batch = writeBatch(db);
  batch.set(doc(db, "classes", value.id), {
    grade: value.grade,
    classNo: value.classNo,
    displayName: value.displayName,
    homeroomTeacherUid: value.homeroomTeacherUid ?? null,
    homeroomTeacherName: value.homeroomTeacherName ?? null,
    active: value.active,
  }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "CLASS_UPDATE" : "CLASS_CREATE", targetType: "class", targetId: value.id, before: before ?? null, after: value });
  await batch.commit();
}

function withHomeroomRole(roles: UserRole[], enabled: boolean): UserRole[] {
  const without = roles.filter((role) => role !== "homeroom_teacher");
  return enabled ? [...without, "homeroom_teacher"] : without;
}

export async function assignHomeroom(input: {
  classRoom: ClassRoom;
  teacher: AppUser | null;
  allClasses: ClassRoom[];
  allUsers: AppUser[];
  actor: AuditActor;
}) {
  const batch = writeBatch(db);
  const previousUid = input.classRoom.homeroomTeacherUid;
  const next = input.teacher;
  batch.set(doc(db, "classes", input.classRoom.id), {
    homeroomTeacherUid: next?.uid ?? null,
    homeroomTeacherName: next?.displayName ?? null,
  }, { merge: true });
  if (next) {
    if (next.homeroomClassId && next.homeroomClassId !== input.classRoom.id) {
      batch.set(doc(db, "classes", next.homeroomClassId), { homeroomTeacherUid: null, homeroomTeacherName: null }, { merge: true });
    }
    batch.set(doc(db, "users", next.uid), { homeroomClassId: input.classRoom.id, roles: withHomeroomRole(next.roles, true) }, { merge: true });
  }
  if (previousUid && previousUid !== next?.uid) {
    const previous = input.allUsers.find((user) => user.uid === previousUid);
    const hasOtherClass = input.allClasses.some((classRoom) => classRoom.id !== input.classRoom.id && classRoom.homeroomTeacherUid === previousUid);
    batch.set(doc(db, "users", previousUid), {
      homeroomClassId: null,
      ...(previous && !hasOtherClass ? { roles: withHomeroomRole(previous.roles, false) } : {}),
    }, { merge: true });
  }
  appendAuditLog(batch, {
    actor: input.actor,
    action: next ? (previousUid ? "HOMEROOM_CHANGE" : "HOMEROOM_ASSIGN") : "HOMEROOM_CLEAR",
    targetType: "class",
    targetId: input.classRoom.id,
    before: { teacherUid: previousUid ?? null },
    after: { teacherUid: next?.uid ?? null, teacherName: next?.displayName ?? null },
  });
  await batch.commit();
}
