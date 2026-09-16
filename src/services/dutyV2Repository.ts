import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, type WriteBatch } from "firebase/firestore";
import { makeDutyAssignmentId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { DutyAssignment, DutyPeriodAssignment } from "../types/domain";

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

/** Adds parent metadata and exactly one period child write to the caller's batch. */
export function writeDutyV2PeriodInBatch(batch: WriteBatch, value: Omit<DutyV2Period, "updatedAt">) {
  const scope: DutyV2Scope = { academicYearId: value.academicYearId, gradeId: value.gradeId, date: value.date };
  batch.set(dutyV2DayRef(scope), { ...dutyV2DayPayload(scope), updatedAt: serverTimestamp() }, { merge: true });
  batch.set(dutyV2PeriodRef(scope, value.periodId), { ...dutyV2PeriodPayload(value), updatedAt: serverTimestamp() }, { merge: true });
}

/** Deletes only the selected child. Empty parents intentionally remain for the next migration phase. */
export function deleteDutyV2PeriodInBatch(batch: WriteBatch, scope: DutyV2Scope, periodId: string) {
  batch.delete(dutyV2PeriodRef(scope, periodId));
}
