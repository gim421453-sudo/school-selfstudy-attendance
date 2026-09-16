import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, Timestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { assertDutyDay } from "../domain/schedule";
import type { DutyAssignment, DutyPeriodAssignment } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { assertOperationalSelfStudyDate } from "./selfStudyExceptions";

export interface DutyAssignmentInput extends DutyPeriodAssignment {
  date: string;
  periodId: string;
  source?: "manual" | "excel";
}

function dutyEditWindow(date: string) {
  const from = new Date(`${date}T00:00:00+09:00`);
  return { editableFrom: Timestamp.fromDate(from), editableUntil: Timestamp.fromMillis(from.getTime() + 24 * 60 * 60 * 1000 - 1) };
}

export async function validateDutyAssignmentDate(date: string): Promise<void> {
  assertDutyDay(date);
  await assertOperationalSelfStudyDate(date);
}

export async function getDutyAssignment(date: string): Promise<DutyAssignment | null> {
  const snap = await getDoc(doc(db, "dutyAssignments", date));
  return snap.exists() ? (snap.data() as DutyAssignment) : null;
}

export async function listDutyAssignmentsByRange(start: string, end: string): Promise<DutyAssignment[]> {
  const snap = await getDocs(query(collection(db, "dutyAssignments"), where("date", ">=", start), where("date", "<=", end), orderBy("date")));
  return snap.docs.map((item) => item.data() as DutyAssignment);
}

export async function saveDutyAssignment(value: DutyAssignmentInput, actor: AuditActor, before?: DutyPeriodAssignment | null) {
  await validateDutyAssignmentDate(value.date);
  const { date, periodId, source = "manual", ...teacher } = value;
  const next = { ...teacher, ...dutyEditWindow(date) };
  const batch = writeBatch(db);
  batch.set(doc(db, "dutyAssignments", date), { date, periods: { [periodId]: next }, source, updatedBy: actor.uid, updatedAt: serverTimestamp() }, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "DUTY_PERIOD_UPDATED" : "DUTY_PERIOD_CREATED", targetType: "duty_assignment", targetId: `${date}/${periodId}`, before: before ? { date, periodId, teacherUid: before.teacherUid, teacherName: before.teacherName } : null, after: { date, periodId, teacherUid: teacher.teacherUid, teacherName: teacher.teacherName }, source });
  await batch.commit();
}

export async function saveDutyAssignmentsBulk(values: DutyAssignmentInput[], actor: AuditActor) {
  await Promise.all(values.map((value) => validateDutyAssignmentDate(value.date)));
  const batch = writeBatch(db);
  for (const value of values) {
    const { date, periodId, source = "excel", ...teacher } = value;
    batch.set(doc(db, "dutyAssignments", date), { date, periods: { [periodId]: { ...teacher, ...dutyEditWindow(date) } }, source, updatedBy: actor.uid, updatedAt: serverTimestamp() }, { merge: true });
  }
  appendAuditLog(batch, { actor, action: "DUTY_SCHEDULE_IMPORT", targetType: "duty_assignment_batch", targetId: crypto.randomUUID(), after: { count: values.length }, source: "excel", batchId: crypto.randomUUID(), batchSize: values.length });
  await batch.commit();
}
