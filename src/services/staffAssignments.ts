import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { makeStaffAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { AppUser, StaffAssignment, StaffRole } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export interface AssignmentInput {
  academicYearId: string;
  gradeId: string;
  uid: string;
  displayName?: string;
}

export type AssignmentNormalizationResult =
  | { assignment: StaffAssignment; rejectedReason: null }
  | { assignment: null; rejectedReason: "invalid_uid" | "invalid_scope" | "invalid_role" | "invalid_active" };

export function normalizeStaffAssignmentDocument(id: string, data: Record<string, unknown>): AssignmentNormalizationResult {
  if (typeof data.uid !== "string" || !data.uid) return { assignment: null, rejectedReason: "invalid_uid" };
  if (typeof data.academicYearId !== "string" || !data.academicYearId || typeof data.gradeId !== "string" || !data.gradeId) return { assignment: null, rejectedReason: "invalid_scope" };
  if (data.role !== "teacher" && data.role !== "grade_admin") return { assignment: null, rejectedReason: "invalid_role" };
  if (typeof data.active !== "boolean") return { assignment: null, rejectedReason: "invalid_active" };
  return {
    assignment: {
      id,
      academicYearId: data.academicYearId,
      gradeId: data.gradeId,
      uid: data.uid,
      role: data.role,
      active: data.active,
      ...(typeof data.displayName === "string" && data.displayName ? { displayName: data.displayName } : {}),
      ...(data.createdAt !== undefined ? { createdAt: data.createdAt } : {}),
      ...(data.updatedAt !== undefined ? { updatedAt: data.updatedAt } : {}),
    },
    rejectedReason: null,
  };
}

export function summarizeStaffAssignmentConsistency(users: AppUser[], assignments: StaffAssignment[]) {
  const userIds = new Set(users.map((user) => user.uid));
  const orphanAssignments = assignments.filter((assignment) => !userIds.has(assignment.uid));
  const nonCanonicalAssignments = assignments.filter((assignment) => assignment.id !== makeStaffAssignmentId(assignment.academicYearId, assignment.gradeId, assignment.uid));
  return {
    userDocumentCount: users.length,
    assignmentCount: assignments.length,
    activeAssignmentCount: assignments.filter((assignment) => assignment.active).length,
    linkedAssignmentCount: assignments.length - orphanAssignments.length,
    orphanAssignmentCount: orphanAssignments.length,
    nonCanonicalDocumentIdCount: nonCanonicalAssignments.length,
  };
}

function validateAssignment(input: AssignmentInput) {
  if (!input.academicYearId.trim() || !input.gradeId.trim() || !input.uid.trim()) {
    throw new Error("학년도, 학년, 교직원을 모두 선택해 주세요.");
  }
}

export function buildStaffAssignmentDocument(input: AssignmentInput, role: StaffRole, active: boolean) {
  return { academicYearId: input.academicYearId, gradeId: input.gradeId, uid: input.uid, role, active, ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}) };
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

export async function listAssignmentsForAuthenticatedUser(uid: string): Promise<{ assignments: StaffAssignment[]; rawSnapshotCount: number; rejectedDocumentCount: number; rejectedReasonCodes: string[] }> {
  const snapshot = await getDocs(query(collection(db, "staffAssignments"), where("uid", "==", uid)));
  const normalized = snapshot.docs.map((item) => normalizeStaffAssignmentDocument(item.id, item.data()));
  const assignments = normalized
    .flatMap((result) => result.assignment ? [result.assignment] : [])
    .sort((left, right) => left.academicYearId.localeCompare(right.academicYearId) || left.gradeId.localeCompare(right.gradeId));
  const rejectedReasonCodes = normalized.flatMap((result) => result.rejectedReason ? [result.rejectedReason] : []);
  return { assignments, rawSnapshotCount: snapshot.size, rejectedDocumentCount: rejectedReasonCodes.length, rejectedReasonCodes: [...new Set(rejectedReasonCodes)] };
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
  const next = { ...buildStaffAssignmentDocument(input, role, true), ...(!input.displayName?.trim() && before?.displayName ? { displayName: before.displayName } : {}) };
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
  const next = buildStaffAssignmentDocument(input, "teacher", before.active);
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
