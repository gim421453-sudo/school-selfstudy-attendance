import type { ScopedStudent, SelfStudyAttendanceReadRow, SelfStudyAttendanceRow, SelfStudyAttendanceStatus, SelfStudyMembership, SelfStudyPermission, SelfStudyPermissionReasonCode } from "../types/domain";

export const SELF_STUDY_ATTENDANCE_LABELS: Record<SelfStudyAttendanceStatus, string> = {
  PRESENT: "출석",
  EXCUSED_ABSENCE: "인정 결석",
  UNEXCUSED_ABSENCE: "미인정 결석",
};

export const SELF_STUDY_PERMISSION_REASON_CODES: SelfStudyPermissionReasonCode[] = ["ACADEMY", "MEDICAL", "FAMILY", "SCHOOL_ACTIVITY", "OTHER"];

export function hasActiveSelfStudyPermission(permission: SelfStudyPermission | null | undefined, periodId: string): boolean {
  return permission?.active === true && permission.periodIds.includes(periodId);
}

/** D3 can use this guard before it writes EXCUSED_ABSENCE. */
export function canUseExcusedAbsence(permission: SelfStudyPermission | null | undefined, periodId: string): boolean {
  return hasActiveSelfStudyPermission(permission, periodId);
}

export function resolveSelfStudyAttendanceStatus(absenceSelected: boolean, permission: SelfStudyPermission | null | undefined, periodId: string): SelfStudyAttendanceStatus {
  if (!absenceSelected) return "PRESENT";
  return canUseExcusedAbsence(permission, periodId) ? "EXCUSED_ABSENCE" : "UNEXCUSED_ABSENCE";
}

export type SelfStudyAttendanceDraft = boolean | undefined;

/** The mobile screen keeps a draft until the teacher explicitly saves it. */
export function resolveSelfStudyAttendanceDisplayStatus(row: SelfStudyAttendanceReadRow, draft: SelfStudyAttendanceDraft): SelfStudyAttendanceStatus | null {
  if (draft === undefined) return row.existingAttendanceStatus;
  if (!draft) return "PRESENT";
  return row.hasPermission ? "EXCUSED_ABSENCE" : "UNEXCUSED_ABSENCE";
}

export function countUnenteredSelfStudyAttendance(rows: SelfStudyAttendanceReadRow[], drafts: Record<string, SelfStudyAttendanceDraft>): number {
  return rows.filter((row) => row.existingAttendanceStatus === null && drafts[row.studentId] === undefined).length;
}

/** Existing records are never selected by the bulk-present shortcut. */
export function buildBulkPresentDraft(rows: SelfStudyAttendanceReadRow[], drafts: Record<string, SelfStudyAttendanceDraft>): Record<string, SelfStudyAttendanceDraft> {
  return rows.reduce<Record<string, SelfStudyAttendanceDraft>>((next, row) => {
    if (row.existingAttendanceStatus === null && next[row.studentId] === undefined) next[row.studentId] = false;
    return next;
  }, { ...drafts });
}

export function selectInitialSelfStudyGroupId(groupIds: string[], currentGroupId: string): string {
  return groupIds.includes(currentGroupId) ? currentGroupId : groupIds[0] ?? "";
}

export function isSelfStudySupervisorEditable(editableFrom: Date | null, editableUntil: Date | null, now = new Date()): boolean {
  return Boolean(editableFrom && editableUntil && now >= editableFrom && now <= editableUntil);
}

/** UI-independent input model for the later current-period attendance screen. */
export function buildSelfStudyAttendanceRows(students: ScopedStudent[], memberships: SelfStudyMembership[], permissions: SelfStudyPermission[]): SelfStudyAttendanceRow[] {
  const membershipByStudent = new Map(memberships.filter((item) => item.active).map((item) => [item.studentId, item]));
  const permissionByStudent = new Map(permissions.filter((item) => item.active).map((item) => [item.studentId, item]));
  return students.filter((student) => student.active).map((student) => {
    const permission = permissionByStudent.get(student.id);
    return {
      studentId: student.id,
      studentName: student.name,
      classId: student.classId,
      selfStudyGroupId: membershipByStudent.get(student.id)?.selfStudyGroupId ?? null,
      permission: permission ? { reasonCode: permission.reasonCode, reasonText: permission.reasonText, periodIds: permission.periodIds } : null,
      status: null,
    };
  });
}
