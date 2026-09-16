import type { SelfStudyAttendanceRecord, SelfStudyException, SelfStudyGroup, SelfStudyGroupPeriod, SupervisionAssignment } from "../types/domain";

export function isExceptionPeriod(exceptions: SelfStudyException[], date: string, periodId: string) {
  return exceptions.some((item) => item.date === date && (item.active === true || (item.active === undefined && item.enabled === true)) && (!item.periodIds || item.periodIds.includes(periodId)));
}
export function missingSupervisionSlots(input: { date: string; groups: SelfStudyGroup[]; edges: SelfStudyGroupPeriod[]; assignments: SupervisionAssignment[]; exceptions: SelfStudyException[]; isOperationalDay: boolean }) {
  if (!input.isOperationalDay) return [];
  return input.groups.filter((group) => group.active).flatMap((group) => input.edges.filter((edge) => edge.active && edge.groupId === group.id && !isExceptionPeriod(input.exceptions, input.date, edge.periodId)).filter((edge) => !input.assignments.some((assignment) => assignment.active && assignment.date === input.date && assignment.selfStudyGroupId === group.id && assignment.periodId === edge.periodId)).map((edge) => ({ groupId: group.id, periodId: edge.periodId })));
}
export function attendanceCounts(records: SelfStudyAttendanceRecord[], expectedStudentIds: string[]) {
  const statuses = records.reduce((counts, record) => ({ ...counts, [record.status]: counts[record.status] + 1 }), { PRESENT: 0, EXCUSED_ABSENCE: 0, UNEXCUSED_ABSENCE: 0 });
  return { ...statuses, MISSING: expectedStudentIds.filter((id) => !records.some((record) => record.studentId === id)).length };
}
