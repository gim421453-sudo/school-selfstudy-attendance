import type { Period, ScopedClassRoom, ScopedStudent, SelfStudyAttendanceRecord, SelfStudyException, SelfStudyGroup, SelfStudyGroupPeriod, SelfStudyMembership, StaffAssignment, SupervisionAssignment } from "../types/domain";
import { isPeriodOperatingOn } from "./schedule";
import { isExceptionPeriod, missingSupervisionSlots } from "./selfStudyDiagnostics";

export interface GradeDashboardDiagnostics {
  studentCount: number; classCount: number; groupCount: number; unassignedStudentCount: number;
  missingGradeAdmin: boolean; missingHomeroomCount: number; missingSupervisionCount: number;
  presentCount: number; excusedCount: number; unexcusedCount: number; missingAttendanceCount: number;
}

export function buildGradeDashboardDiagnostics(input: {
  date: string; periods: Period[]; students: ScopedStudent[]; classes: ScopedClassRoom[]; groups: SelfStudyGroup[];
  memberships: SelfStudyMembership[]; edges: SelfStudyGroupPeriod[]; assignments: StaffAssignment[];
  supervision: SupervisionAssignment[]; exceptions: SelfStudyException[]; attendance: SelfStudyAttendanceRecord[];
}): GradeDashboardDiagnostics {
  const students = input.students.filter((student) => student.active);
  const classes = input.classes.filter((classRoom) => classRoom.active);
  const groups = input.groups.filter((group) => group.active);
  const memberships = input.memberships.filter((membership) => membership.active);
  const activePeriods = new Map(input.periods.filter((period) => period.active).map((period) => [period.id, period]));
  const expected = memberships.flatMap((membership) => input.edges.filter((edge) => edge.active && edge.groupId === membership.selfStudyGroupId && activePeriods.has(edge.periodId) && isPeriodOperatingOn(input.date, activePeriods.get(edge.periodId)!) && !isExceptionPeriod(input.exceptions, input.date, edge.periodId)).map((edge) => `${membership.studentId}:${edge.periodId}:${membership.selfStudyGroupId}`));
  const recorded = new Set(input.attendance.map((record) => `${record.studentId}:${record.periodId}:${record.selfStudyGroupId}`));
  return {
    studentCount: students.length, classCount: classes.length, groupCount: groups.length,
    unassignedStudentCount: students.filter((student) => !memberships.some((membership) => membership.studentId === student.id)).length,
    missingGradeAdmin: !input.assignments.some((assignment) => assignment.active && assignment.role === "grade_admin"),
    missingHomeroomCount: classes.filter((classRoom) => !classRoom.homeroomTeacherUid).length,
    missingSupervisionCount: missingSupervisionSlots({ date: input.date, groups, edges: input.edges, periods: input.periods, assignments: input.supervision, exceptions: input.exceptions }).length,
    presentCount: input.attendance.filter((record) => record.status === "PRESENT").length,
    excusedCount: input.attendance.filter((record) => record.status === "EXCUSED_ABSENCE").length,
    unexcusedCount: input.attendance.filter((record) => record.status === "UNEXCUSED_ABSENCE").length,
    missingAttendanceCount: expected.filter((key) => !recorded.has(key)).length,
  };
}
