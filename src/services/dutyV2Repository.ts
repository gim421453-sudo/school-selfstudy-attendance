import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, type WriteBatch } from "firebase/firestore";
import { makeDutyAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { DutyAssignment, DutyPeriodAssignment } from "../types/domain";

export const FIRESTORE_BATCH_WRITE_LIMIT = 500;

export interface DutyV2Scope {
  academicYearId: string;
  gradeId: string;
  date: string;
}

export interface DutyV2Day extends DutyV2Scope {
  schemaVersion: 2;
  updatedAt?: unknown;
}

export interface DutyV2Period extends DutyV2Scope, DutyPeriodAssignment {
  periodId: string;
  updatedAt?: unknown;
}

export interface DutyV2Range {
  start: string;
  end: string;
}

export function dutyV2DayId(gradeId: string, date: string) {
  return makeDutyAssignmentId(gradeId, date);
}

export function dutyV2DayRef(scope: DutyV2Scope) {
  return doc(db, "dutyAssignments", dutyV2DayId(scope.gradeId, scope.date));
}

export function dutyV2PeriodRef(scope: DutyV2Scope, periodId: string) {
  return doc(dutyV2DayRef(scope), "periods", periodId);
}

export function dutyV2DayPayload(scope: DutyV2Scope): Omit<DutyV2Day, "updatedAt"> {
  return { ...scope, schemaVersion: 2 };
}

export function dutyV2PeriodPayload(value: Omit<DutyV2Period, "updatedAt">): Omit<DutyV2Period, "updatedAt"> {
  return { ...value };
}

/** Reconstructs the existing public DutyAssignment shape from V2 storage records. */
export function reconstructDutyV2Assignment(day: DutyV2Day | null, periods: DutyV2Period[]): DutyAssignment | null {
  if (!day || day.schemaVersion !== 2) return null;
  const mapped: Record<string, DutyPeriodAssignment> = {};
  for (const period of periods) {
    if (period.academicYearId !== day.academicYearId || period.gradeId !== day.gradeId || period.date !== day.date) continue;
    const { periodId, academicYearId: _year, gradeId: _grade, date: _date, updatedAt: _updatedAt, ...assignment } = period;
    mapped[periodId] = assignment;
  }
  return { academicYearId: day.academicYearId, gradeId: day.gradeId, date: day.date, periods: mapped, updatedAt: day.updatedAt };
}

export async function getDutyV2Day(scope: DutyV2Scope): Promise<DutyV2Day | null> {
  const snapshot = await getDoc(dutyV2DayRef(scope));
  if (!snapshot.exists()) return null;
  const value = snapshot.data() as DutyV2Day;
  return value.schemaVersion === 2 && value.academicYearId === scope.academicYearId && value.gradeId === scope.gradeId && value.date === scope.date ? value : null;
}

export async function assertDutyV2DayWritable(scope: DutyV2Scope): Promise<void> {
  const snapshot = await getDoc(dutyV2DayRef(scope));
  if (snapshot.exists() && snapshot.data().schemaVersion !== 2) {
    throw new Error("기존 V1 담당교사 데이터는 V2 단건 수정으로 변경할 수 없습니다.");
  }
}

export function countDutyV2BulkOperations(periodCount: number, distinctDayCount: number, auditWriteCount = 1): number {
  return periodCount + distinctDayCount + auditWriteCount;
}

export function assertDutyV2BulkOperationLimit(periodCount: number, distinctDayCount: number, auditWriteCount = 1): void {
  const count = countDutyV2BulkOperations(periodCount, distinctDayCount, auditWriteCount);
  if (count > FIRESTORE_BATCH_WRITE_LIMIT) {
    throw new Error(`담당교사 일괄 반영은 최대 ${FIRESTORE_BATCH_WRITE_LIMIT}개 Firestore 작업까지 가능합니다. 현재 작업 수: ${count}`);
  }
}

export function selectDutyV2Days(days: DutyV2Day[], scope: Omit<DutyV2Scope, "date">, range: DutyV2Range): DutyV2Day[] {
  return days.filter((day) => day.schemaVersion === 2 && day.academicYearId === scope.academicYearId && day.gradeId === scope.gradeId && day.date >= range.start && day.date <= range.end);
}

export function omitEmptyDutyV2Assignments(assignments: Array<DutyAssignment | null>): DutyAssignment[] {
  return assignments.filter((assignment): assignment is DutyAssignment => assignment !== null && Object.keys(assignment.periods).length > 0);
}

export async function listDutyV2Periods(scope: DutyV2Scope): Promise<DutyV2Period[]> {
  const snapshot = await getDocs(query(collection(dutyV2DayRef(scope), "periods"), orderBy("periodId")));
  return snapshot.docs
    .map((item) => ({ id: item.id, value: item.data() as DutyV2Period }))
    .filter(({ id, value }) => value.academicYearId === scope.academicYearId && value.gradeId === scope.gradeId && value.date === scope.date && value.periodId === id)
    .map(({ value }) => value);
}

export async function readDutyV2Assignment(scope: DutyV2Scope): Promise<DutyAssignment | null> {
  const [day, periods] = await Promise.all([getDutyV2Day(scope), listDutyV2Periods(scope)]);
  return reconstructDutyV2Assignment(day, periods);
}

/** Lists only V2 parents in the requested scope and omits empty parent containers. */
export async function listDutyV2Assignments(scope: Omit<DutyV2Scope, "date">, range: DutyV2Range): Promise<DutyAssignment[]> {
  const snapshot = await getDocs(query(
    collection(db, "dutyAssignments"),
    where("academicYearId", "==", scope.academicYearId),
    where("gradeId", "==", scope.gradeId),
    where("date", ">=", range.start),
    where("date", "<=", range.end),
    orderBy("date"),
  ));
  const days = selectDutyV2Days(snapshot.docs.map((item) => item.data() as DutyV2Day), scope, range);
  const assignments = await Promise.all(days.map(async (day) => {
    const periods = await listDutyV2Periods(day);
    return reconstructDutyV2Assignment(day, periods);
  }));
  return omitEmptyDutyV2Assignments(assignments);
}

/** Adds only V2 parent metadata to the caller batch. */
export function writeDutyV2DayInBatch(batch: WriteBatch, scope: DutyV2Scope) {
  batch.set(dutyV2DayRef(scope), { ...dutyV2DayPayload(scope), updatedAt: serverTimestamp() }, { merge: true });
}

/** Adds exactly one V2 period child write to the caller batch. */
export function writeDutyV2PeriodChildInBatch(batch: WriteBatch, value: Omit<DutyV2Period, "updatedAt">) {
  const scope: DutyV2Scope = { academicYearId: value.academicYearId, gradeId: value.gradeId, date: value.date };
  batch.set(dutyV2PeriodRef(scope, value.periodId), { ...dutyV2PeriodPayload(value), updatedAt: serverTimestamp() }, { merge: true });
}

/** Adds parent metadata and exactly one period child write to the caller's batch. */
export function writeDutyV2PeriodInBatch(batch: WriteBatch, value: Omit<DutyV2Period, "updatedAt">) {
  const scope: DutyV2Scope = { academicYearId: value.academicYearId, gradeId: value.gradeId, date: value.date };
  writeDutyV2DayInBatch(batch, scope);
  writeDutyV2PeriodChildInBatch(batch, value);
}

/** Deletes only the selected child. Empty parents intentionally remain for the next migration phase. */
export function deleteDutyV2PeriodInBatch(batch: WriteBatch, scope: DutyV2Scope, periodId: string) {
  batch.delete(dutyV2PeriodRef(scope, periodId));
}
