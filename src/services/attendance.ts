import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { assertSelfStudyDay } from "../domain/schedule";
import { assertOperationalSelfStudyDate } from "./selfStudyExceptions";
import { appendAuditLog, type AuditActor } from "./audit";
import type { AttendanceRecord, AttendanceStatus } from "../types/domain";

export async function validateAttendanceWriteDate(date: string): Promise<void> {
  assertSelfStudyDay(date);
  await assertOperationalSelfStudyDate(date);
}

export async function listAttendance(date: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, "attendance", date, "records"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, "id">) }));
}

export async function markAttendance(input: {
  date: string;
  studentId: string;
  classId: string;
  periodId: string;
  status: AttendanceStatus;
  note?: string;
  actor: AuditActor;
  before?: AttendanceRecord | null;
}) {
  await validateAttendanceWriteDate(input.date);
  const id = `${input.classId}__${input.periodId}__${input.studentId}`;
  const batch = writeBatch(db);
  batch.set(doc(db, "attendance", input.date, "records", id), {
      date: input.date,
      studentId: input.studentId,
      classId: input.classId,
      periodId: input.periodId,
      status: input.status,
      note: input.note ?? "",
      markedBy: input.actor.uid,
      markedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
  }, { merge: true });
  appendAuditLog(batch, {
    actor: input.actor,
    action: input.before ? "ATTENDANCE_UPDATE" : "ATTENDANCE_CREATE",
    targetType: "attendance",
    targetId: `${input.date}/${id}`,
    before: input.before ? { status: input.before.status, note: input.before.note } : null,
    after: { status: input.status, note: input.note ?? "" },
  });
  await batch.commit();
}
