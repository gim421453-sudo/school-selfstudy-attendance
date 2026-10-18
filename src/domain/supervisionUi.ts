import { isPeriodOperatingOn } from "./schedule";
import type { SelfStudyGroup, SelfStudyGroupPeriod, StaffAssignment, SupervisionAssignment } from "../types/domain";

export function supervisionDaySummary(date: string, periods: any[], groups: SelfStudyGroup[], edges: SelfStudyGroupPeriod[], assignments: SupervisionAssignment[]) {
  const activePeriods = periods.filter((period) => period.active && isPeriodOperatingOn(date, period));
  const activeGroups = new Set(groups.filter((group) => group.active).map((group) => group.id));
  const slots = edges.filter((edge) => edge.active && activeGroups.has(edge.groupId) && activePeriods.some((period) => period.id === edge.periodId));
  const assigned = new Set(assignments.filter((assignment) => assignment.active && assignment.date === date).map((assignment) => `${assignment.periodId}:${assignment.selfStudyGroupId}`));
  const complete = slots.filter((slot) => assigned.has(`${slot.periodId}:${slot.groupId}`)).length;
  return { operatingPeriods: activePeriods.length, assigned: complete, missing: slots.length - complete };
}

export function validateSupervisionImportRow(row: { date: string; period: string; group: string; teacher: string }, input: { periods: any[]; groups: SelfStudyGroup[]; edges: SelfStudyGroupPeriod[]; teachers: StaffAssignment[]; date: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return "\uC798\uBABB\uB41C \uB0A0\uC9DC";
  const period = input.periods.find((item) => item.id === row.period || item.name === row.period);
  if (!period || !period.active) return "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uAD50\uC2DC";
  if (!isPeriodOperatingOn(row.date, period)) return "\uD574\uB2F9 \uB0A0\uC9DC\uC5D0 \uC6B4\uC601\uD558\uC9C0 \uC54A\uB294 \uAD50\uC2DC";
  const group = input.groups.find((item) => item.id === row.group || item.displayName === row.group);
  if (!group || !group.active || !input.edges.some((edge) => edge.active && edge.groupId === group.id && edge.periodId === period.id)) return "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC790\uC2B5\uADF8\uB8F9";
  const teachers = input.teachers.filter((item) => item.active && (item.uid === row.teacher || item.displayName === row.teacher));
  return teachers.length !== 1 ? "\uAD50\uC0AC \uC815\uBCF4\uAC00 \uC5C6\uAC70\uB098 \uBAA8\uD638\uD569\uB2C8\uB2E4." : null;
}

export type SupervisionImportPreview = { index: number; date: string; period?: any; group?: any; teacher?: StaffAssignment; status: "신규" | "변경 없음" | "중복" | "오류"; reason: string | null };

/** Builds the Excel preview; `month` is the selected "yyyy-MM" and rows outside it are errors. */
export function buildSupervisionImportPreview(rawRows: Record<string, unknown>[], input: { periods: any[]; groups: SelfStudyGroup[]; edges: SelfStudyGroupPeriod[]; teachers: StaffAssignment[]; month: string; existing: Pick<SupervisionAssignment, "active" | "date" | "periodId" | "selfStudyGroupId" | "teacherUid">[] }): SupervisionImportPreview[] {
  const seen = new Set<string>();
  return rawRows.map((raw, index) => {
    const row = { date: String(raw["날짜"] ?? raw.date ?? ""), period: String(raw["교시"] ?? raw.period ?? ""), group: String(raw["자습그룹"] ?? raw.group ?? ""), teacher: String(raw["감독교사"] ?? raw.teacher ?? "") };
    const reason = validateSupervisionImportRow(row, { ...input, date: row.date }) ?? (row.date.startsWith(`${input.month}-`) ? null : "선택한 월 밖의 날짜");
    const period = input.periods.find((item) => item.id === row.period || item.name === row.period); const group = input.groups.find((item) => item.id === row.group || item.displayName === row.group); const matches = input.teachers.filter((item) => item.uid === row.teacher || item.displayName === row.teacher); const teacher = matches.length === 1 ? matches[0] : undefined;
    const key = `${row.date}:${period?.id}:${group?.id}:${teacher?.uid}`; const duplicate = !reason && seen.has(key); seen.add(key);
    const unchanged = !reason && !duplicate && input.existing.some((item) => item.active && item.date === row.date && item.periodId === period?.id && item.selfStudyGroupId === group?.id && item.teacherUid === teacher?.uid);
    return { index: index + 2, date: row.date, period, group, teacher, reason: reason ?? (duplicate ? "파일 내 중복 행" : null), status: reason ? "오류" : duplicate ? "중복" : unchanged ? "변경 없음" : "신규" };
  });
}

export function canCommitSupervisionImport(preview: SupervisionImportPreview[]): boolean {
  return preview.length > 0 && !preview.some((row) => row.reason);
}
