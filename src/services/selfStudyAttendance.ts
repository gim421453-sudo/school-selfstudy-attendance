import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { makeSelfStudyAttendanceRecordId, makeSelfStudyGroupPeriodId, makeSelfStudyMembershipId, makeSelfStudyPermissionId, makeSupervisionAssignmentId } from "../domain/ids";
import { resolveSelfStudyAttendanceStatus } from "../domain/selfStudyOperation";
import { db } from "../lib/firebase";
import type { SelfStudyAttendanceReadRow, SelfStudyAttendanceRecord, SelfStudyPermission } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getClass } from "./classes";
import { getScopedPeriod } from "./scopedPeriods";
import { getStudent, listScopedStudents } from "./scopedStudents";
import { getSelfStudyPermission, listSelfStudyGroupPeriods, listSelfStudyGroups, listSelfStudyMemberships } from "./selfStudyOperations";

export interface SelfStudyAttendanceScope { academicYearId: string; gradeId: string; }
export interface SelfStudyAttendanceAccess { isSystemOwner?: boolean; isGradeAdmin?: boolean; now?: Date; }
export interface SelfStudyAttendanceWriteInput extends SelfStudyAttendanceScope {
  date: string; periodId: string; studentId: string; classId: string; selfStudyGroupId: string;
  absenceSelected: boolean; actor: AuditActor; access?: SelfStudyAttendanceAccess;
}

function validateScope(scope: SelfStudyAttendanceScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년이 필요합니다.");
}

function validateDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
}

function asDate(value: unknown): Date | null {
  return value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : null;
}

export function buildSelfStudyAttendanceRecord(input: Omit<SelfStudyAttendanceRecord, "id" | "recordedAt" | "updatedAt">): Omit<SelfStudyAttendanceRecord, "id" | "recordedAt" | "updatedAt"> {
  validateScope(input); validateDate(input.date);
  if (!input.periodId.trim() || !input.studentId.trim() || !input.classId.trim() || !input.selfStudyGroupId.trim() || !input.recordedByUid.trim() || !input.updatedByUid.trim()) throw new Error("자습 출결 식별 정보가 필요합니다.");
  if (input.schemaVersion !== 1 || !["PRESENT", "EXCUSED_ABSENCE", "UNEXCUSED_ABSENCE"].includes(input.status)) throw new Error("올바르지 않은 자습 출결 상태입니다.");
  const excused = input.status === "EXCUSED_ABSENCE";
  if (excused && (!input.permissionId || !input.permissionReasonCode || !input.permissionReasonText?.trim())) throw new Error("인정 결석에는 permission snapshot이 필요합니다.");
  if (!excused && (input.permissionId || input.permissionReasonCode || input.permissionReasonText)) throw new Error("출석 또는 무단 결석에는 permission snapshot을 저장할 수 없습니다.");
  return { ...input, ...(excused ? { permissionReasonText: input.permissionReasonText!.trim() } : {}) };
}

export async function getSelfStudyAttendanceRecord(scope: SelfStudyAttendanceScope, date: string, periodId: string, studentId: string): Promise<SelfStudyAttendanceRecord | null> {
  const id = makeSelfStudyAttendanceRecordId(scope.academicYearId, scope.gradeId, date, periodId, studentId);
  const snapshot = await getDoc(doc(db, "selfStudyAttendanceRecords", id));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<SelfStudyAttendanceRecord, "id">) } : null;
}

export async function listSelfStudyAttendanceRecords(scope: SelfStudyAttendanceScope, date: string, periodId: string, selfStudyGroupId: string): Promise<SelfStudyAttendanceRecord[]> {
  validateScope(scope); validateDate(date);
  const snapshot = await getDocs(query(collection(db, "selfStudyAttendanceRecords"), where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId), where("date", "==", date), where("periodId", "==", periodId), where("selfStudyGroupId", "==", selfStudyGroupId), orderBy("studentId")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SelfStudyAttendanceRecord, "id">) }));
}

async function validateWriteReferences(input: SelfStudyAttendanceWriteInput) {
  validateScope(input); validateDate(input.date);
  const scope = { academicYearId: input.academicYearId, gradeId: input.gradeId };
  const [student, classRoom, period, membership, group, groupPeriod, supervision, permission] = await Promise.all([
    getStudent(input.studentId), getClass(input.classId), getScopedPeriod(input.periodId),
    getDoc(doc(db, "selfStudyMemberships", makeSelfStudyMembershipId(input.academicYearId, input.gradeId, input.studentId))),
    getDoc(doc(db, "selfStudyGroups", input.selfStudyGroupId)),
    getDoc(doc(db, "selfStudyGroupPeriods", makeSelfStudyGroupPeriodId(input.selfStudyGroupId, input.periodId))),
    getDoc(doc(db, "supervisionAssignments", makeSupervisionAssignmentId(input.gradeId, input.date, input.periodId, input.selfStudyGroupId, input.actor.uid))),
    getSelfStudyPermission(scope, input.studentId, input.date),
  ]);
  if (!student?.active || student.academicYearId !== input.academicYearId || student.gradeId !== input.gradeId || student.classId !== input.classId) throw new Error("학생 scope가 일치하지 않습니다.");
  if (!classRoom?.active || classRoom.academicYearId !== input.academicYearId || classRoom.gradeId !== input.gradeId) throw new Error("반 scope가 일치하지 않습니다.");
  if (!period?.active || period.academicYearId !== input.academicYearId || period.gradeId !== input.gradeId) throw new Error("활성 자습 교시가 아닙니다.");
  const sameScope = (value: { academicYearId?: string; gradeId?: string } | undefined) => value?.academicYearId === input.academicYearId && value.gradeId === input.gradeId;
  if (!membership.exists() || !sameScope(membership.data()) || membership.data().active !== true || membership.data().classId !== input.classId || membership.data().selfStudyGroupId !== input.selfStudyGroupId) throw new Error("학생의 활성 자습 그룹 배정이 일치하지 않습니다.");
  if (!group.exists() || !sameScope(group.data()) || group.data().active !== true) throw new Error("활성 자습 그룹이 아닙니다.");
  if (!groupPeriod.exists() || !sameScope(groupPeriod.data()) || groupPeriod.data().active !== true) throw new Error("이 자습 그룹은 해당 교시에 운영되지 않습니다.");
  const privileged = input.access?.isSystemOwner || input.access?.isGradeAdmin;
  if (!privileged) {
    const assignment = supervision.data(); const from = asDate(assignment?.editableFrom); const until = asDate(assignment?.editableUntil); const now = input.access?.now ?? new Date();
    if (!supervision.exists() || assignment?.active !== true || assignment?.teacherUid !== input.actor.uid || !from || !until || now < from || now > until) throw new Error("감독 배정 또는 수정 가능 시간이 일치하지 않습니다.");
  }
  return permission;
}

export async function writeSelfStudyAttendance(input: SelfStudyAttendanceWriteInput) {
  const permission = await validateWriteReferences(input);
  const status = resolveSelfStudyAttendanceStatus(input.absenceSelected, permission, input.periodId);
  const id = makeSelfStudyAttendanceRecordId(input.academicYearId, input.gradeId, input.date, input.periodId, input.studentId);
  const before = await getSelfStudyAttendanceRecord(input, input.date, input.periodId, input.studentId);
  const base = buildSelfStudyAttendanceRecord({ academicYearId: input.academicYearId, gradeId: input.gradeId, date: input.date, periodId: input.periodId, studentId: input.studentId, classId: input.classId, selfStudyGroupId: input.selfStudyGroupId, status, ...(status === "EXCUSED_ABSENCE" ? { permissionId: makeSelfStudyPermissionId(input.academicYearId, input.gradeId, input.studentId, input.date), permissionReasonCode: permission!.reasonCode, permissionReasonText: permission!.reasonText } : {}), recordedByUid: before?.recordedByUid ?? input.actor.uid, updatedByUid: input.actor.uid, schemaVersion: 1 });
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyAttendanceRecords", id), { ...base, ...(before ? {} : { recordedAt: serverTimestamp() }), updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor: input.actor, action: before ? (input.access?.isSystemOwner || input.access?.isGradeAdmin ? "SELF_STUDY_ATTENDANCE_CORRECTED" : "SELF_STUDY_ATTENDANCE_UPDATED") : "SELF_STUDY_ATTENDANCE_CREATED", targetType: "self_study_attendance", targetId: id, before: before ?? null, after: base, academicYearId: input.academicYearId, gradeId: input.gradeId, classId: input.classId, studentId: input.studentId, periodId: input.periodId, selfStudyGroupId: input.selfStudyGroupId, dutyDate: input.date });
  await batch.commit();
}

export async function listSelfStudyAttendanceReadRows(input: SelfStudyAttendanceScope & { teacherUid: string; date: string; periodId: string; selfStudyGroupId: string; access?: Pick<SelfStudyAttendanceAccess, "isSystemOwner" | "isGradeAdmin"> }): Promise<SelfStudyAttendanceReadRow[]> {
  const scope = { academicYearId: input.academicYearId, gradeId: input.gradeId };
  const supervision = await getDoc(doc(db, "supervisionAssignments", makeSupervisionAssignmentId(input.gradeId, input.date, input.periodId, input.selfStudyGroupId, input.teacherUid)));
  const privileged = input.access?.isSystemOwner || input.access?.isGradeAdmin;
  if (!privileged && (!supervision.exists() || supervision.data().active !== true || supervision.data().teacherUid !== input.teacherUid)) return [];
  const [students, memberships, groups, groupPeriods, records] = await Promise.all([listScopedStudents(scope), listSelfStudyMemberships(scope), listSelfStudyGroups(scope), listSelfStudyGroupPeriods(scope), listSelfStudyAttendanceRecords(scope, input.date, input.periodId, input.selfStudyGroupId)]);
  const group = groups.find((item) => item.id === input.selfStudyGroupId && item.active);
  if (!group || !groupPeriods.some((item) => item.active && item.groupId === group.id && item.periodId === input.periodId)) return [];
  const recordByStudent = new Map(records.map((item) => [item.studentId, item]));
  return (await Promise.all(students.filter((student) => student.active && memberships.some((membership) => membership.active && membership.studentId === student.id && membership.selfStudyGroupId === group.id)).map(async (student) => {
    const [classRoom, permission] = await Promise.all([getClass(student.classId), getSelfStudyPermission(scope, student.id, input.date)]);
    const record = recordByStudent.get(student.id);
    return { studentId: student.id, studentName: student.name, classId: student.classId, classDisplayName: classRoom?.displayName ?? student.classId, selfStudyGroupId: group.id, selfStudyGroupDisplayName: group.displayName, existingAttendanceStatus: record?.status ?? null, hasPermission: Boolean(permission?.active && permission.periodIds.includes(input.periodId)), ...(permission?.active && permission.periodIds.includes(input.periodId) ? { permissionReasonCode: permission.reasonCode, permissionReasonText: permission.reasonText } : {}) };
  }))).sort((left, right) => left.classDisplayName.localeCompare(right.classDisplayName) || left.studentName.localeCompare(right.studentName));
}
