import {
  collection,
  collectionGroup,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { assertSelfStudyDay } from "../domain/schedule";
import { assertOperationalSelfStudyDate } from "./selfStudyExceptions";
import { appendAuditLog, type AuditActor } from "./audit";
import type { AttendanceRecord, AttendanceStatus, Student } from "../types/domain";

export async function validateAttendanceWriteDate(date: string): Promise<void> {
  assertSelfStudyDay(date);
  await assertOperationalSelfStudyDate(date);
}

export async function listAttendance(date: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(collection(db, "attendance", date, "records"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AttendanceRecord, "id">) }));
}

export async function listAttendanceByRange(start: string, end: string): Promise<AttendanceRecord[]> {
  const snap = await getDocs(query(
    collectionGroup(db, "records"),
    where("date", ">=", start),
    where("date", "<=", end),
    orderBy("date"),
  ));
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

export async function markStudentsPresent(input: {
  date: string;
  students: Student[];
  classId: string;
  periodId: string;
  actor: AuditActor;
}) {
  await validateAttendanceWriteDate(input.date);
  const batch = writeBatch(db);
  for (const student of input.students) {
    const id = `${input.classId}__${input.periodId}__${student.id}`;
    batch.set(doc(db, "attendance", input.date, "records", id), {
      date: input.date,
      studentId: student.id,
      classId: input.classId,
      periodId: input.periodId,
      status: "present",
      note: "",
      markedBy: input.actor.uid,
      markedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
  const batchId = crypto.randomUUID();
  appendAuditLog(batch, {
    actor: input.actor,
    action: "ATTENDANCE_BULK_PRESENT",
    targetType: "attendance_batch",
    targetId: `${input.date}/${input.classId}/${input.periodId}`,
    after: { status: "present", studentCount: input.students.length },
    batchId,
    batchSize: input.students.length,
  });
  await batch.commit();
}
