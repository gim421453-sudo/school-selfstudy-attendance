import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { makeSelfStudyGroupPeriodId, makeSelfStudyMembershipId, makeSelfStudyPermissionId, makeStaffAssignmentId, makeSupervisionAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { SelfStudyGroup, SelfStudyGroupPeriod, SelfStudyMembership, SelfStudyPermission, SupervisionAssignment } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getClass } from "./classes";
import { getScopedPeriod } from "./scopedPeriods";
import { getStudent } from "./scopedStudents";

export interface SelfStudyScope { academicYearId: string; gradeId: string; }

function validateScope(scope: SelfStudyScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("Academic year and grade are required.");
}

function validateDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must use YYYY-MM-DD.");
}

function withId<T extends object>(id: string, value: T) { return { id, ...value }; }

export function buildSelfStudyGroup(value: Omit<SelfStudyGroup, "id" | "createdAt" | "updatedAt">) {
  validateScope(value);
  if (!value.displayName.trim() || value.displayName.trim().length > 120 || !Number.isInteger(value.sortOrder) || value.sortOrder < 0) throw new Error("Invalid self-study group.");
  return { ...value, displayName: value.displayName.trim() };
}

export async function listSelfStudyGroups(scope: SelfStudyScope): Promise<SelfStudyGroup[]> {
  validateScope(scope);
  const snapshot = await getDocs(query(collection(db, "selfStudyGroups"), where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId), orderBy("sortOrder")));
  return snapshot.docs.map((item) => withId(item.id, item.data() as Omit<SelfStudyGroup, "id">));
}

export async function createSelfStudyGroup(value: Omit<SelfStudyGroup, "id" | "createdAt" | "updatedAt">, actor: AuditActor): Promise<string> {
  const next = buildSelfStudyGroup(value);
  const ref = doc(collection(db, "selfStudyGroups"));
  const batch = writeBatch(db);
  batch.set(ref, { ...next, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "SELF_STUDY_GROUP_CREATED", targetType: "self_study_group", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId });
  await batch.commit();
  return ref.id;
}

export async function saveSelfStudyGroup(value: SelfStudyGroup, actor: AuditActor, before?: SelfStudyGroup | null) {
  const next = buildSelfStudyGroup(value);
  if (before && (before.academicYearId !== next.academicYearId || before.gradeId !== next.gradeId)) throw new Error("Self-study group scope cannot change.");
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyGroups", value.id), { ...next, ...(before ? { updatedAt: serverTimestamp() } : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }) }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "SELF_STUDY_GROUP_UPDATED" : "SELF_STUDY_GROUP_CREATED", targetType: "self_study_group", targetId: value.id, before: before ?? null, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId });
  await batch.commit();
}

export function buildSelfStudyGroupPeriod(value: Omit<SelfStudyGroupPeriod, "id" | "updatedAt">) {
  validateScope(value);
  if (!value.groupId.trim() || !value.periodId.trim()) throw new Error("Group and period are required.");
  return value;
}

export async function listSelfStudyGroupPeriods(scope: SelfStudyScope, groupId?: string): Promise<SelfStudyGroupPeriod[]> {
  validateScope(scope);
  const constraints = [where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId)];
  if (groupId) constraints.push(where("groupId", "==", groupId));
  const snapshot = await getDocs(query(collection(db, "selfStudyGroupPeriods"), ...constraints, orderBy("periodId")));
  return snapshot.docs.map((item) => withId(item.id, item.data() as Omit<SelfStudyGroupPeriod, "id">));
}

export async function saveSelfStudyGroupPeriod(value: Omit<SelfStudyGroupPeriod, "id" | "updatedAt">, actor: AuditActor, before?: SelfStudyGroupPeriod | null) {
  const next = buildSelfStudyGroupPeriod(value);
  const id = makeSelfStudyGroupPeriodId(next.groupId, next.periodId);
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyGroupPeriods", id), { ...next, updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor, action: next.active ? "SELF_STUDY_GROUP_PERIOD_ADDED" : "SELF_STUDY_GROUP_PERIOD_REMOVED", targetType: "self_study_group_period", targetId: id, before: before ?? null, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, periodId: next.periodId });
  await batch.commit();
}

export function buildSelfStudyMembership(value: Omit<SelfStudyMembership, "id" | "updatedAt">) {
  validateScope(value);
  if (!value.studentId.trim() || !value.classId.trim() || !value.selfStudyGroupId.trim()) throw new Error("Student, class, and group are required.");
  return value;
}

export async function listSelfStudyMemberships(scope: SelfStudyScope, classId?: string): Promise<SelfStudyMembership[]> {
  validateScope(scope);
  const constraints = [where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId)];
  if (classId) constraints.push(where("classId", "==", classId));
  const snapshot = await getDocs(query(collection(db, "selfStudyMemberships"), ...constraints, orderBy("studentId")));
  return snapshot.docs.map((item) => withId(item.id, item.data() as Omit<SelfStudyMembership, "id">));
}

export async function saveSelfStudyMembership(value: Omit<SelfStudyMembership, "id" | "updatedAt">, actor: AuditActor, before?: SelfStudyMembership | null) {
  const next = buildSelfStudyMembership(value);
  const id = makeSelfStudyMembershipId(next.academicYearId, next.gradeId, next.studentId);
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyMemberships", id), { ...next, updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor, action: !next.active ? "SELF_STUDY_MEMBERSHIP_DEACTIVATED" : before ? "SELF_STUDY_MEMBERSHIP_CHANGED" : "SELF_STUDY_MEMBERSHIP_ASSIGNED", targetType: "self_study_membership", targetId: id, before: before ?? null, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, classId: next.classId, studentId: next.studentId });
  await batch.commit();
}

export function buildSupervisionAssignment(value: Omit<SupervisionAssignment, "id" | "updatedAt">) {
  validateScope(value); validateDate(value.date);
  if (!value.periodId.trim() || !value.selfStudyGroupId.trim() || !value.teacherUid.trim() || !value.teacherDisplayName.trim()) throw new Error("Invalid supervision assignment.");
  return { ...value, teacherDisplayName: value.teacherDisplayName.trim() };
}

export async function listSupervisionAssignments(scope: SelfStudyScope, filters: { date?: string; periodId?: string; teacherUid?: string } = {}): Promise<SupervisionAssignment[]> {
  validateScope(scope);
  const constraints = [where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId)];
  if (filters.date) constraints.push(where("date", "==", filters.date));
  if (filters.periodId) constraints.push(where("periodId", "==", filters.periodId));
  if (filters.teacherUid) constraints.push(where("teacherUid", "==", filters.teacherUid));
  const snapshot = await getDocs(query(collection(db, "supervisionAssignments"), ...constraints, orderBy("date"), orderBy("periodId"), orderBy("selfStudyGroupId")));
  return snapshot.docs.map((item) => withId(item.id, item.data() as Omit<SupervisionAssignment, "id">));
}

export async function listSupervisionAssignmentsForTeacher(scope: SelfStudyScope, teacherUid: string, date: string, periodId: string) {
  return listSupervisionAssignments(scope, { teacherUid, date, periodId });
}

/** D3B can use this scoped result without reading the users collection. */
export function supervisedGroupIdsForTeacher(assignments: SupervisionAssignment[], teacherUid: string, date: string, periodId: string) {
  return [...new Set(assignments.filter((assignment) => assignment.active && assignment.teacherUid === teacherUid && assignment.date === date && assignment.periodId === periodId).map((assignment) => assignment.selfStudyGroupId))];
}

async function validateActiveSupervisionReferences(value: Omit<SupervisionAssignment, "id" | "updatedAt">) {
  const [group, period, groupPeriod, staff] = await Promise.all([
    getDoc(doc(db, "selfStudyGroups", value.selfStudyGroupId)),
    getDoc(doc(db, "periods", value.periodId)),
    getDoc(doc(db, "selfStudyGroupPeriods", makeSelfStudyGroupPeriodId(value.selfStudyGroupId, value.periodId))),
    getDoc(doc(db, "staffAssignments", makeStaffAssignmentId(value.academicYearId, value.gradeId, value.teacherUid))),
  ]);
  const inScope = (snapshot: typeof group) => snapshot.exists() && snapshot.data().academicYearId === value.academicYearId && snapshot.data().gradeId === value.gradeId;
  if (!inScope(group) || group.data()?.active !== true) throw new Error("활성 자습 그룹이 필요합니다.");
  if (!inScope(period) || period.data()?.active !== true) throw new Error("활성 자습 교시가 필요합니다.");
  if (!inScope(groupPeriod) || groupPeriod.data()?.groupId !== value.selfStudyGroupId || groupPeriod.data()?.periodId !== value.periodId || groupPeriod.data()?.active !== true) throw new Error("해당 자습 그룹은 이 교시에 운영되지 않습니다.");
  if (!inScope(staff) || staff.data()?.uid !== value.teacherUid || staff.data()?.active !== true || !["teacher", "grade_admin"].includes(staff.data()?.role)) throw new Error("해당 학년의 활성 교직원 배정이 필요합니다.");
}

export async function saveSupervisionAssignment(value: Omit<SupervisionAssignment, "id" | "updatedAt">, actor: AuditActor, before?: SupervisionAssignment | null) {
  const next = buildSupervisionAssignment(value);
  await validateActiveSupervisionReferences(next);
  const id = makeSupervisionAssignmentId(next.gradeId, next.date, next.periodId, next.selfStudyGroupId, next.teacherUid);
  const batch = writeBatch(db);
  batch.set(doc(db, "supervisionAssignments", id), { ...next, updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "SUPERVISION_ASSIGNMENT_UPDATED" : "SUPERVISION_ASSIGNMENT_CREATED", targetType: "supervision_assignment", targetId: id, before: before ?? null, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, periodId: next.periodId, dutyDate: next.date });
  await batch.commit();
}

export async function deactivateSupervisionAssignment(value: SupervisionAssignment, actor: AuditActor) {
  if (!value.active) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "supervisionAssignments", value.id), { active: false, updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "SUPERVISION_ASSIGNMENT_REMOVED", targetType: "supervision_assignment", targetId: value.id, before: value, after: { ...value, active: false }, academicYearId: value.academicYearId, gradeId: value.gradeId, periodId: value.periodId, dutyDate: value.date });
  await batch.commit();
}

export function buildSelfStudyPermission(value: Omit<SelfStudyPermission, "id" | "approvedAt" | "updatedAt">) {
  validateScope(value); validateDate(value.date);
  if (!value.classId.trim() || !value.studentId.trim() || !value.approvedByUid.trim() || !value.reasonText.trim() || value.reasonText.trim().length > 1000 || value.periodIds.length === 0 || new Set(value.periodIds).size !== value.periodIds.length) throw new Error("Invalid self-study permission.");
  return { ...value, periodIds: [...value.periodIds], reasonText: value.reasonText.trim() };
}

export async function getSelfStudyPermission(scope: SelfStudyScope, studentId: string, date: string): Promise<SelfStudyPermission | null> {
  const id = makeSelfStudyPermissionId(scope.academicYearId, scope.gradeId, studentId, date);
  const snapshot = await getDoc(doc(db, "selfStudyPermissions", id));
  return snapshot.exists() ? withId(snapshot.id, snapshot.data() as Omit<SelfStudyPermission, "id">) : null;
}

export async function listSelfStudyPermissions(scope: SelfStudyScope, date: string, classId?: string): Promise<SelfStudyPermission[]> {
  validateScope(scope); validateDate(date);
  const constraints = [where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId), where("date", "==", date)];
  if (classId) constraints.push(where("classId", "==", classId));
  const snapshot = await getDocs(query(collection(db, "selfStudyPermissions"), ...constraints, orderBy("studentId")));
  return snapshot.docs.map((item) => withId(item.id, item.data() as Omit<SelfStudyPermission, "id">));
}

async function validatePermissionReferences(value: Omit<SelfStudyPermission, "id" | "approvedAt" | "updatedAt">) {
  const [student, classRoom, membership] = await Promise.all([
    getStudent(value.studentId), getClass(value.classId),
    getDoc(doc(db, "selfStudyMemberships", makeSelfStudyMembershipId(value.academicYearId, value.gradeId, value.studentId))),
  ]);
  if (!student?.active || student.academicYearId !== value.academicYearId || student.gradeId !== value.gradeId || student.classId !== value.classId) throw new Error("학생 scope가 일치하지 않습니다.");
  if (!classRoom?.active || classRoom.academicYearId !== value.academicYearId || classRoom.gradeId !== value.gradeId) throw new Error("반 scope가 일치하지 않습니다.");
  if (!membership.exists() || membership.data().active !== true || membership.data().classId !== value.classId || membership.data().academicYearId !== value.academicYearId || membership.data().gradeId !== value.gradeId) throw new Error("학생의 활성 자습 그룹 배정이 필요합니다.");
  const group = await getDoc(doc(db, "selfStudyGroups", membership.data().selfStudyGroupId));
  if (!group.exists() || group.data().active !== true || group.data().academicYearId !== value.academicYearId || group.data().gradeId !== value.gradeId) throw new Error("활성 자습 그룹이 필요합니다.");
  await Promise.all(value.periodIds.map(async (periodId) => {
    const [period, edge] = await Promise.all([getScopedPeriod(periodId), getDoc(doc(db, "selfStudyGroupPeriods", makeSelfStudyGroupPeriodId(membership.data().selfStudyGroupId, periodId)))]);
    if (!period?.active || period.academicYearId !== value.academicYearId || period.gradeId !== value.gradeId || !edge.exists() || edge.data().active !== true) throw new Error("선택한 교시는 해당 학생의 활성 자습 운영 교시가 아닙니다.");
  }));
}

async function assertPermissionAuthority(value: Omit<SelfStudyPermission, "id" | "approvedAt" | "updatedAt">, actor: AuditActor, isSystemOwner: boolean) {
  if (isSystemOwner) return;
  const classRoom = await getClass(value.classId);
  if (classRoom?.homeroomTeacherUid !== actor.uid) throw new Error("담임교사만 자기 반 자습 예외를 변경할 수 있습니다.");
}

export async function saveSelfStudyPermission(value: Omit<SelfStudyPermission, "id" | "approvedAt" | "updatedAt">, actor: AuditActor, before?: SelfStudyPermission | null, access: { isSystemOwner?: boolean } = {}) {
  const draft = buildSelfStudyPermission(value);
  await assertPermissionAuthority(draft, actor, Boolean(access.isSystemOwner));
  await validatePermissionReferences(draft);
  const next = before ? { ...draft, approvedByUid: before.approvedByUid } : draft;
  const id = makeSelfStudyPermissionId(next.academicYearId, next.gradeId, next.studentId, next.date);
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyPermissions", id), { ...next, ...(before ? {} : { approvedAt: serverTimestamp() }), updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "SELF_STUDY_PERMISSION_UPDATED" : "SELF_STUDY_PERMISSION_CREATED", targetType: "self_study_permission", targetId: id, before: before ?? null, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, classId: next.classId, studentId: next.studentId, dutyDate: next.date });
  await batch.commit();
}

export async function cancelSelfStudyPermission(value: SelfStudyPermission, actor: AuditActor, access: { isSystemOwner?: boolean } = {}) {
  if (!value.active) return;
  await assertPermissionAuthority(value, actor, Boolean(access.isSystemOwner));
  const batch = writeBatch(db);
  batch.update(doc(db, "selfStudyPermissions", value.id), { active: false, updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "SELF_STUDY_PERMISSION_CANCELLED", targetType: "self_study_permission", targetId: value.id, before: value, after: { ...value, active: false }, academicYearId: value.academicYearId, gradeId: value.gradeId, classId: value.classId, studentId: value.studentId, dutyDate: value.date });
  await batch.commit();
}
