import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { makeStaffAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { StaffAssignment, StaffRole } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export interface AssignmentInput {
  academicYearId: string;
  gradeId: string;
  uid: string;
}

function validateAssignment(input: AssignmentInput) {
  if (!input.academicYearId.trim() || !input.gradeId.trim() || !input.uid.trim()) {
    throw new Error("학년도, 학년, 교직원을 모두 선택해 주세요.");
  }
}

function assignmentDocument(input: AssignmentInput, role: StaffRole, active: boolean) {
  return { academicYearId: input.academicYearId, gradeId: input.gradeId, uid: input.uid, role, active };
}

export async function listAssignmentsForYear(academicYearId: string): Promise<StaffAssignment[]> {
  const snapshot = await getDocs(query(collection(db, "staffAssignments"), where("academicYearId", "==", academicYearId), orderBy("gradeId"), orderBy("uid")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<StaffAssignment, "id">) }));
}

export async function listAssignmentsForGrade(academicYearId: string, gradeId: string): Promise<StaffAssignment[]> {
  const snapshot = await getDocs(query(collection(db, "staffAssignments"), where("academicYearId", "==", academicYearId), where("gradeId", "==", gradeId), orderBy("uid")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<StaffAssignment, "id">) }));
}

export async function listAssignmentsForUser(academicYearId: string, uid: string): Promise<StaffAssignment[]> {
  const snapshot = await getDocs(query(collection(db, "staffAssignments"), where("academicYearId", "==", academicYearId), where("uid", "==", uid), orderBy("gradeId")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<StaffAssignment, "id">) }));
}

export async function getAssignment(academicYearId: string, gradeId: string, uid: string): Promise<StaffAssignment | null> {
  const id = makeStaffAssignmentId(academicYearId, gradeId, uid);
  const snapshot = await getDoc(doc(db, "staffAssignments", id));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<StaffAssignment, "id">) } : null;
}

async function saveAssignment(input: AssignmentInput, role: StaffRole, action: string, actor: AuditActor) {
  validateAssignment(input);
  const id = makeStaffAssignmentId(input.academicYearId, input.gradeId, input.uid);
  const before = await getAssignment(input.academicYearId, input.gradeId, input.uid);
  const next = assignmentDocument(input, role, true);
  const batch = writeBatch(db);
  batch.set(doc(db, "staffAssignments", id), {
    ...next,
    ...(before ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
  }, { merge: true });
  appendAuditLog(batch, {
    actor,
    action,
    targetType: "staff_assignment",
    targetId: id,
    before: before ? { academicYearId: before.academicYearId, gradeId: before.gradeId, uid: before.uid, role: before.role, active: before.active } : null,
    after: next,
  });
  await batch.commit();
}

export async function assignTeacherToGrade(input: AssignmentInput, actor: AuditActor) {
  const before = await getAssignment(input.academicYearId, input.gradeId, input.uid);
  await saveAssignment(input, "teacher", before ? "STAFF_ASSIGNMENT_UPDATED" : "STAFF_ASSIGNMENT_CREATED", actor);
}

export async function setGradeAdmin(input: AssignmentInput, actor: AuditActor) {
  await saveAssignment(input, "grade_admin", "GRADE_ADMIN_ASSIGNED", actor);
}

export async function removeGradeAdmin(input: AssignmentInput, actor: AuditActor) {
  validateAssignment(input);
  const before = await getAssignment(input.academicYearId, input.gradeId, input.uid);
  if (!before || before.role !== "grade_admin") return;
  const id = makeStaffAssignmentId(input.academicYearId, input.gradeId, input.uid);
  const next = assignmentDocument(input, "teacher", before.active);
  const batch = writeBatch(db);
  batch.update(doc(db, "staffAssignments", id), { role: "teacher", updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "GRADE_ADMIN_REMOVED", targetType: "staff_assignment", targetId: id, before: { ...before }, after: next });
  await batch.commit();
}

export async function deactivateStaffAssignment(input: AssignmentInput, actor: AuditActor) {
  validateAssignment(input);
  const before = await getAssignment(input.academicYearId, input.gradeId, input.uid);
  if (!before || !before.active) return;
  const id = makeStaffAssignmentId(input.academicYearId, input.gradeId, input.uid);
  const batch = writeBatch(db);
  batch.update(doc(db, "staffAssignments", id), { active: false, updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "STAFF_ASSIGNMENT_REMOVED", targetType: "staff_assignment", targetId: id, before: { ...before }, after: { ...before, active: false } });
  await batch.commit();
}
