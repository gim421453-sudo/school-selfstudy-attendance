import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import type { StudentImportRow } from "../lib/excel";
import type { Period, Student } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export async function listStudents(): Promise<Student[]> {
  const snap = await getDocs(query(collection(db, "students"), orderBy("classId"), orderBy("studentNo")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Student, "id">) }));
}

export async function addStudent(student: Omit<Student, "id">, actor: AuditActor) {
  const batch = writeBatch(db);
  const ref = doc(collection(db, "students"));
  batch.set(ref, student);
  appendAuditLog(batch, { actor, action: "STUDENT_CREATE", targetType: "student", targetId: ref.id, after: student });
  await batch.commit();
}

export async function updateStudent(student: Student, actor: AuditActor, before: Student) {
  const { id, ...data } = student;
  const batch = writeBatch(db);
  batch.set(doc(db, "students", id), data, { merge: true });
  appendAuditLog(batch, { actor, action: student.active ? "STUDENT_UPDATE" : "STUDENT_DEACTIVATE", targetType: "student", targetId: id, before, after: data });
  await batch.commit();
}

export async function commitStudentImport(rows: StudentImportRow[], actor: AuditActor) {
  if (rows.some((row) => row.change === "error" || row.change === "conflict")) {
    throw new Error("Resolve all student import errors before committing.");
  }
  const batch = writeBatch(db);
  for (const row of rows) {
    if (row.change === "unchanged") continue;
    const ref = row.existingStudent ? doc(db, "students", row.existingStudent.id) : doc(collection(db, "students"));
    batch.set(ref, {
      classId: row.classId,
      studentNo: row.studentNo,
      name: row.name,
      active: true,
    }, { merge: true });
  }
  const changed = rows.filter((row) => row.change !== "unchanged");
  appendAuditLog(batch, { actor, action: "STUDENT_IMPORT", targetType: "student_batch", targetId: crypto.randomUUID(), after: { newCount: rows.filter((row) => row.change === "new").length, updateCount: rows.filter((row) => row.change === "update").length }, source: "excel", batchId: crypto.randomUUID(), batchSize: changed.length });
  await batch.commit();
}

export async function listPeriods(): Promise<Period[]> {
  const snap = await getDocs(query(collection(db, "periods"), orderBy("order")));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Period, "id">) }));
}

export function validatePeriod(period: Period, existing: Period[]): void {
  if (!period.name.trim()) throw new Error("\uAD50\uC2DC\uBA85\uC740 \uBE44\uC5B4 \uC788\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  if (!Number.isInteger(period.order) || period.order < 1) throw new Error("\uC21C\uC11C\uB294 1 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(period.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(period.endTime)) throw new Error("\uC2DC\uAC04\uC740 HH:mm \uD615\uC2DD\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  if (period.startTime >= period.endTime) throw new Error("\uC2DC\uC791 \uC2DC\uAC04\uC740 \uC885\uB8CC \uC2DC\uAC04\uBCF4\uB2E4 \uC774\uB974\uC5B4\uC57C \uD569\uB2C8\uB2E4.");
  if (existing.some((item) => item.id !== period.id && item.order === period.order)) throw new Error("\uAC19\uC740 \uC21C\uC11C\uC758 \uAD50\uC2DC\uAC00 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4.");
}

export function periodAuditChange(period: Period, before?: Period | null) {
  const { id: _id, ...after } = period;
  const prior = before ? (({ id: _beforeId, ...values }) => values)(before) : null;
  return { action: before ? "PERIOD_UPDATED" : "PERIOD_CREATED", before: prior, after };
}

export async function savePeriod(period: Period, actor: AuditActor, before?: Period | null) {
  validatePeriod(period, await listPeriods());
  const { id, ...data } = period;
  const batch = writeBatch(db);
  batch.set(doc(db, "periods", id), data, { merge: true });
  const audit = periodAuditChange(period, before);
  appendAuditLog(batch, { actor, action: audit.action, targetType: "period", targetId: id, before: audit.before, after: audit.after });
  await batch.commit();
}
