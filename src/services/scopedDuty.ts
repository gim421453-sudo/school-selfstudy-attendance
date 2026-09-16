import { Timestamp, writeBatch } from "firebase/firestore";
import type { DutyPeriodImportRow } from "../lib/excel";
import { makeDutyAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { AppUser, DutyAssignment, DutyPeriodAssignment } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { assertDutyV2BulkOperationLimit, assertDutyV2DayWritable, deleteDutyV2PeriodInBatch, listDutyV2Assignments, readDutyV2Assignment, writeDutyV2DayInBatch, writeDutyV2PeriodChildInBatch, writeDutyV2PeriodInBatch } from "./dutyV2Repository";
import { assertScopedSelfStudyDate } from "./scopedExceptions";
import { getScopedPeriod, type ScopedPeriod } from "./scopedPeriods";
import { getAssignment, listAssignmentsForGrade } from "./staffAssignments";
import { getAppUser } from "./users";

export interface DutyScope { academicYearId: string; gradeId: string; }
export interface ScopedDutyAssignment extends DutyAssignment { academicYearId: string; gradeId: string; }
export interface ScopedDutyInput extends DutyPeriodAssignment, DutyScope { date: string; periodId: string; source?: "manual" | "excel"; }
export interface DutyRange { start: string; end: string; }
export interface EligibleDutyTeacher { user: AppUser; }
export interface ScopedDutyImportPreview extends DutyScope { rows: DutyPeriodImportRow[]; }

function dutyWindow(date: string) {
  const from = new Date(`${date}T00:00:00+09:00`);
  return { editableFrom: Timestamp.fromDate(from), editableUntil: Timestamp.fromMillis(from.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

function assertValidDutyDate(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error("담당교사 날짜는 YYYY-MM-DD 형식이어야 합니다.");
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) throw new Error("유효하지 않은 담당교사 날짜입니다.");
}

function validateScope(scope: DutyScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년을 지정해 주세요.");
}

export async function listEligibleTeachersForGrade(academicYearId: string, gradeId: string): Promise<EligibleDutyTeacher[]> {
  const assignments = await listAssignmentsForGrade(academicYearId, gradeId);
  const users = await Promise.all(assignments.filter((assignment) => assignment.active).map((assignment) => getAppUser(assignment.uid)));
  return users.flatMap((user) => user?.active ? [{ user }] : []);
}

async function validateTeacher(input: ScopedDutyInput) {
  const assignment = await getAssignment(input.academicYearId, input.gradeId, input.teacherUid);
  if (!assignment?.active) throw new Error("해당 학년도와 학년에 배정된 활성 교직원만 담당교사로 지정할 수 있습니다.");
}

async function validatePeriod(input: ScopedDutyInput): Promise<ScopedPeriod> {
  const period = await getScopedPeriod(input.periodId);
  if (!period?.active || period.academicYearId !== input.academicYearId || period.gradeId !== input.gradeId) throw new Error("선택한 scope에 활성 교시가 없습니다.");
  return period;
}

export async function getScopedDutyAssignment(academicYearId: string, gradeId: string, date: string): Promise<ScopedDutyAssignment | null> {
  return readDutyV2Assignment({ academicYearId, gradeId, date }) as Promise<ScopedDutyAssignment | null>;
}

export async function listScopedDutyAssignments(academicYearId: string, gradeId: string, range: DutyRange): Promise<ScopedDutyAssignment[]> {
  validateScope({ academicYearId, gradeId });
  return listDutyV2Assignments({ academicYearId, gradeId }, range) as Promise<ScopedDutyAssignment[]>;
}

export async function savePeriodDutyAssignment(input: ScopedDutyInput, actor: AuditActor, before?: DutyPeriodAssignment | null) {
  validateScope(input);
  await Promise.all([assertScopedSelfStudyDate(input.academicYearId, input.gradeId, input.date), validateTeacher(input), validatePeriod(input)]);
  const id = makeDutyAssignmentId(input.gradeId, input.date);
  const { academicYearId, gradeId, date, periodId, source = "manual", ...teacher } = input;
  const next = { ...teacher, ...dutyWindow(date) };
  await assertDutyV2DayWritable({ academicYearId, gradeId, date });
  const batch = writeBatch(db);
  writeDutyV2PeriodInBatch(batch, { academicYearId, gradeId, date, periodId, ...next });
  appendAuditLog(batch, { actor, action: before ? "DUTY_PERIOD_CHANGED" : "DUTY_PERIOD_ASSIGNED", targetType: "duty_assignment", targetId: `${id}/${periodId}`, before: before ?? null, after: { date, periodId, teacherUid: teacher.teacherUid, teacherName: teacher.teacherName }, source, academicYearId, gradeId, periodId, dutyDate: date });
  await batch.commit();
}

export async function removePeriodDutyAssignment(scope: DutyScope & { date: string; periodId: string }, actor: AuditActor) {
  const current = await getScopedDutyAssignment(scope.academicYearId, scope.gradeId, scope.date);
  const before = current?.periods[scope.periodId];
  if (!before) return;
  const id = makeDutyAssignmentId(scope.gradeId, scope.date);
  const batch = writeBatch(db);
  deleteDutyV2PeriodInBatch(batch, { academicYearId: scope.academicYearId, gradeId: scope.gradeId, date: scope.date }, scope.periodId);
  appendAuditLog(batch, { actor, action: "DUTY_PERIOD_REMOVED", targetType: "duty_assignment", targetId: `${id}/${scope.periodId}`, before: { date: scope.date, periodId: scope.periodId, teacherUid: before.teacherUid, teacherName: before.teacherName }, after: null, academicYearId: scope.academicYearId, gradeId: scope.gradeId, periodId: scope.periodId, dutyDate: scope.date });
  await batch.commit();
}

/** Validates a dynamically parsed workbook against the selected scope before confirmation. */
export function buildScopedDutyImportPreview(scope: DutyScope, rows: DutyPeriodImportRow[], activePeriods: ScopedPeriod[], eligibleTeachers: EligibleDutyTeacher[], blockedDates: Set<string> = new Set()): ScopedDutyImportPreview {
  validateScope(scope);
  const periodIds = new Set(activePeriods.filter((period) => period.active && period.academicYearId === scope.academicYearId && period.gradeId === scope.gradeId).map((period) => period.id));
  const teacherIds = new Set(eligibleTeachers.map((teacher) => teacher.user.uid));
  return {
    ...scope,
    rows: rows.map((row) => {
      if (row.error) return row;
      if (blockedDates.has(row.date)) return { ...row, error: "Selected scope is not operating on this date." };
      if (!periodIds.has(row.periodId)) return { ...row, error: "Period is not active in the selected scope." };
      if (!row.matchedUser || !teacherIds.has(row.matchedUser.uid)) return { ...row, error: "Teacher is not eligible for the selected scope." };
      return row;
    }),
  };
}

export async function bulkImportDutyAssignments(preview: ScopedDutyImportPreview, actor: AuditActor) {
  if (preview.rows.some((row) => row.error || !row.matchedUser)) throw new Error("오류를 해결한 후 적용해 주세요.");
  const targets = new Set<string>();
  for (const row of preview.rows) {
    assertValidDutyDate(row.date);
    const target = `${row.date}/${row.periodId}`;
    if (targets.has(target)) throw new Error("같은 날짜와 교시의 담당교사 행이 중복되었습니다.");
    targets.add(target);
  }
  await Promise.all(preview.rows.map((row) => Promise.all([
    assertScopedSelfStudyDate(preview.academicYearId, preview.gradeId, row.date),
    validateTeacher({ ...preview, date: row.date, periodId: row.periodId, teacherUid: row.matchedUser!.uid, teacherName: row.matchedUser!.displayName }),
    validatePeriod({ ...preview, date: row.date, periodId: row.periodId, teacherUid: row.matchedUser!.uid, teacherName: row.matchedUser!.displayName }),
  ])));
  const dates = [...new Set(preview.rows.map((row) => row.date))];
  await Promise.all(dates.map((date) => assertDutyV2DayWritable({ academicYearId: preview.academicYearId, gradeId: preview.gradeId, date })));
  assertDutyV2BulkOperationLimit(preview.rows.length, dates.length);
  const batch = writeBatch(db);
  for (const date of dates) {
    writeDutyV2DayInBatch(batch, { academicYearId: preview.academicYearId, gradeId: preview.gradeId, date });
  }
  for (const row of preview.rows) {
    const window = dutyWindow(row.date);
    if (window.editableFrom.toMillis() >= window.editableUntil.toMillis()) throw new Error("담당교사 수정 가능 시간이 올바르지 않습니다.");
    writeDutyV2PeriodChildInBatch(batch, { academicYearId: preview.academicYearId, gradeId: preview.gradeId, date: row.date, periodId: row.periodId, teacherUid: row.matchedUser!.uid, teacherName: row.matchedUser!.displayName, teacherEmail: row.matchedUser!.email, ...window });
  }
  const sortedDates = [...dates].sort();
  appendAuditLog(batch, { actor, action: "DUTY_IMPORT_APPLIED", targetType: "duty_assignment_import", targetId: crypto.randomUUID(), after: { count: preview.rows.length, periodCount: preview.rows.length, dateRange: { start: sortedDates[0], end: sortedDates.at(-1) } }, source: "excel", batchId: crypto.randomUUID(), batchSize: preview.rows.length, academicYearId: preview.academicYearId, gradeId: preview.gradeId });
  await batch.commit();
}

// Scoped service API aliases; legacy duty.ts continues to serve the v0.6 UI.
export const getDutyAssignment = getScopedDutyAssignment;
export const listDutyAssignments = listScopedDutyAssignments;
