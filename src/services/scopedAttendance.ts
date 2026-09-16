import { collection, collectionGroup, doc, documentId, getDoc, getDocs, limit, orderBy, query, serverTimestamp, startAfter, where, writeBatch } from "firebase/firestore";
import { makeAttendanceDayId, makeAttendanceRecordId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { AttendanceRecord, AttendanceStatus, ScopedStudent } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getClass } from "./classes";
import { getScopedDutyAssignment } from "./scopedDuty";
import { assertScopedSelfStudyDate } from "./scopedExceptions";
import { getScopedPeriod } from "./scopedPeriods";
import { getStudent } from "./scopedStudents";

export interface AttendanceScope { academicYearId: string; gradeId: string; }
export interface AttendanceAccessContext { isSystemOwner?: boolean; isGradeAdmin?: boolean; now?: Date; }
export interface ScopedAttendanceInput extends AttendanceScope {
  date: string;
  classId: string;
  studentId: string;
  periodId: string;
  status: AttendanceStatus;
  note?: string;
  actor: AuditActor;
  access?: AttendanceAccessContext;
}
export interface AttendanceHistoryFilter extends AttendanceScope {
  startDate: string;
  endDate: string;
  classId?: string;
  studentId?: string;
  periodId?: string;
  status?: AttendanceStatus;
  markedBy?: string;
  pageSize?: number;
  after?: { date: string; id: string };
}
export interface AttendanceHistoryPage { records: AttendanceRecord[]; next?: { date: string; id: string }; }

function validateScope(scope: AttendanceScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년을 지정해 주세요.");
}

function validateStatus(status: AttendanceStatus) {
  if (!["present", "late", "absent", "excused", "early_leave"].includes(status)) throw new Error("알 수 없는 출결 상태입니다.");
}

export async function listScopedAttendance(input: AttendanceScope & { date: string }): Promise<AttendanceRecord[]> {
  validateScope(input);
  const dayId = makeAttendanceDayId(input.gradeId, input.date);
  const snapshot = await getDocs(query(collection(db, "attendance", dayId, "records"), orderBy("classId"), orderBy("studentId"), orderBy("periodId")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AttendanceRecord, "id">) }))
    .filter((record) => record.academicYearId === input.academicYearId && record.gradeId === input.gradeId);
}

export async function getAttendanceRecord(input: AttendanceScope & { date: string; classId: string; studentId: string; periodId: string }): Promise<AttendanceRecord | null> {
  const id = makeAttendanceRecordId(input.classId, input.periodId, input.studentId);
  const snapshot = await getDoc(doc(db, "attendance", makeAttendanceDayId(input.gradeId, input.date), "records", id));
  if (!snapshot.exists()) return null;
  const record = { id: snapshot.id, ...(snapshot.data() as Omit<AttendanceRecord, "id">) };
  return record.academicYearId === input.academicYearId && record.gradeId === input.gradeId ? record : null;
}

async function validateAttendanceEntities(input: ScopedAttendanceInput) {
  validateScope(input);
  validateStatus(input.status);
  const [student, classRoom, period, duty] = await Promise.all([
    getStudent(input.studentId), getClass(input.classId), getScopedPeriod(input.periodId), getScopedDutyAssignment(input.academicYearId, input.gradeId, input.date),
  ]);
  if (!student || student.academicYearId !== input.academicYearId || student.gradeId !== input.gradeId) throw new Error("학생 scope가 일치하지 않습니다.");
  if (!classRoom?.academicYearId || classRoom.academicYearId !== input.academicYearId || classRoom.gradeId !== input.gradeId || student.classId !== classRoom.id) throw new Error("반과 학생 scope가 일치하지 않습니다.");
  if (!period?.active || period.academicYearId !== input.academicYearId || period.gradeId !== input.gradeId) throw new Error("교시 scope가 일치하지 않습니다.");
  if (!duty || duty.academicYearId !== input.academicYearId || duty.gradeId !== input.gradeId || !duty.periods[input.periodId]) throw new Error("해당 scope에 교시별 담당교사가 없습니다.");
  await assertScopedSelfStudyDate(input.academicYearId, input.gradeId, input.date);
  const privileged = input.access?.isSystemOwner || input.access?.isGradeAdmin;
  if (!privileged) {
    const assignment = duty.periods[input.periodId];
    const now = input.access?.now ?? new Date();
    const from = assignment.editableFrom && "toDate" in (assignment.editableFrom as object) ? (assignment.editableFrom as { toDate(): Date }).toDate() : null;
    const until = assignment.editableUntil && "toDate" in (assignment.editableUntil as object) ? (assignment.editableUntil as { toDate(): Date }).toDate() : null;
    if (assignment.teacherUid !== input.actor.uid || !from || !until || now < from || now > until) throw new Error("담당 교사의 출결 수정 가능 시간이 아닙니다.");
  }
  return student;
}

export async function markScopedAttendance(input: ScopedAttendanceInput) {
  await validateAttendanceEntities(input);
  const before = await getAttendanceRecord(input);
  const id = makeAttendanceRecordId(input.classId, input.periodId, input.studentId);
  const next = { academicYearId: input.academicYearId, gradeId: input.gradeId, date: input.date, classId: input.classId, studentId: input.studentId, periodId: input.periodId, status: input.status, note: input.note ?? "", markedBy: input.actor.uid, markedAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.set(doc(db, "attendance", makeAttendanceDayId(input.gradeId, input.date), "records", id), next, { merge: true });
  appendAuditLog(batch, { actor: input.actor, action: before ? "ATTENDANCE_UPDATED" : "ATTENDANCE_CREATED", targetType: "attendance", targetId: `${makeAttendanceDayId(input.gradeId, input.date)}/${id}`, before: before ? { status: before.status, note: before.note } : null, after: { status: input.status, note: input.note ?? "" }, academicYearId: input.academicYearId, gradeId: input.gradeId, classId: input.classId, studentId: input.studentId, periodId: input.periodId, dutyDate: input.date });
  await batch.commit();
}

export async function bulkMarkScopedAttendance(input: Omit<ScopedAttendanceInput, "studentId" | "status" | "note"> & { students: ScopedStudent[]; status?: AttendanceStatus }) {
  const status = input.status ?? "present";
  const validationInputs = input.students.map((student) => ({ ...input, studentId: student.id, status, note: "" }));
  await Promise.all(validationInputs.map((value) => validateAttendanceEntities(value)));
  const batch = writeBatch(db);
  for (const student of input.students) {
    const id = makeAttendanceRecordId(input.classId, input.periodId, student.id);
    batch.set(doc(db, "attendance", makeAttendanceDayId(input.gradeId, input.date), "records", id), { academicYearId: input.academicYearId, gradeId: input.gradeId, date: input.date, classId: input.classId, studentId: student.id, periodId: input.periodId, status, note: "", markedBy: input.actor.uid, markedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
  }
  appendAuditLog(batch, { actor: input.actor, action: "BULK_ATTENDANCE_MARKED", targetType: "attendance_batch", targetId: `${makeAttendanceDayId(input.gradeId, input.date)}/${input.classId}/${input.periodId}`, after: { status, studentCount: input.students.length }, batchId: crypto.randomUUID(), batchSize: input.students.length, academicYearId: input.academicYearId, gradeId: input.gradeId, classId: input.classId, periodId: input.periodId, dutyDate: input.date });
  await batch.commit();
}

export async function listScopedAttendanceHistory(filter: AttendanceHistoryFilter): Promise<AttendanceHistoryPage> {
  validateScope(filter);
  const constraints = [where("academicYearId", "==", filter.academicYearId), where("gradeId", "==", filter.gradeId), where("date", ">=", filter.startDate), where("date", "<=", filter.endDate)];
  if (filter.classId) constraints.push(where("classId", "==", filter.classId));
  if (filter.studentId) constraints.push(where("studentId", "==", filter.studentId));
  if (filter.periodId) constraints.push(where("periodId", "==", filter.periodId));
  if (filter.status) constraints.push(where("status", "==", filter.status));
  if (filter.markedBy) constraints.push(where("markedBy", "==", filter.markedBy));
  const ordering = [orderBy("date"), orderBy(documentId())];
  const pagination = filter.after ? [startAfter(filter.after.date, filter.after.id)] : [];
  const snapshot = await getDocs(query(collectionGroup(db, "records"), ...constraints, ...ordering, ...pagination, limit(Math.min(Math.max(filter.pageSize ?? 100, 1), 500))));
  const records = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AttendanceRecord, "id">) }));
  const last = records.at(-1);
  return { records, ...(last?.id ? { next: { date: last.date, id: last.id } } : {}) };
}

export const listAttendance = listScopedAttendance;
export const markAttendance = markScopedAttendance;
export const bulkMarkAttendance = bulkMarkScopedAttendance;
