import { isExceptionPeriod } from "./selfStudyDiagnostics";
import { isPeriodOperatingOn, isSelfStudyPeriod } from "./schedule";
import type { Period, SelfStudyAttendanceRecord, SelfStudyException, SelfStudyGroupPeriod, SelfStudyMembership } from "../types/domain";

function datesBetween(start: string, end: string): string[] {
  const values: string[] = [];
  for (let cursor = new Date(`${start}T12:00:00`), last = new Date(`${end}T12:00:00`); cursor <= last; cursor.setDate(cursor.getDate() + 1)) values.push(cursor.toISOString().slice(0, 10));
  return values;
}

export function selfStudyAttendanceCoverage(input: { startDate: string; endDate: string; memberships: SelfStudyMembership[]; edges: SelfStudyGroupPeriod[]; periods: Period[]; exceptions: SelfStudyException[]; records: SelfStudyAttendanceRecord[] }) {
  const periods = new Map(input.periods.filter((period) => period.active && isSelfStudyPeriod(period)).map((period) => [period.id, period]));
  const expected = new Set<string>();
  for (const date of datesBetween(input.startDate, input.endDate)) for (const membership of input.memberships.filter((item) => item.active)) for (const edge of input.edges.filter((item) => item.active && item.groupId === membership.selfStudyGroupId)) {
    const period = periods.get(edge.periodId);
    if (period && isPeriodOperatingOn(date, period) && !isExceptionPeriod(input.exceptions, date, edge.periodId)) expected.add(`${date}:${membership.studentId}:${edge.periodId}:${membership.selfStudyGroupId}`);
  }
  const recorded = new Set(input.records.map((record) => `${record.date}:${record.studentId}:${record.periodId}:${record.selfStudyGroupId}`));
  return { expected: expected.size, missing: [...expected].filter((key) => !recorded.has(key)).length };
}
