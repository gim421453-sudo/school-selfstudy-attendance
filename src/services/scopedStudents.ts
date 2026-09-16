import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import type { StudentImportRow, StudentImportSummary } from "../lib/excel";
import { db } from "../lib/firebase";
import type { ClassRoom, ScopedClassRoom, ScopedStudent } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getClass, listClasses } from "./classes";

export interface StudentScopeInput {
  academicYearId: string;
  gradeId: string;
  classId?: string;
}

export interface ScopedStudentImportPreview extends StudentImportSummary {
  academicYearId: string;
  gradeId: string;
}

export function buildScopedStudentImportPreview(scope: StudentScopeInput, summary: StudentImportSummary, classes: ScopedClassRoom[]): ScopedStudentImportPreview {
  validateScope(scope);
  const scopedClassIds = new Set(classes
    .filter((classRoom) => classRoom.academicYearId === scope.academicYearId && classRoom.gradeId === scope.gradeId)
    .map((classRoom) => classRoom.id));
  const rows = summary.rows.map((row) => scopedClassIds.has(row.classId)
    ? row
    : { ...row, change: "error" as const, error: "Selected academic year/grade does not contain this class." });
  return {
    academicYearId: scope.academicYearId,
    gradeId: scope.gradeId,
    rows,
    newCount: rows.filter((row) => row.change === "new").length,
    updateCount: rows.filter((row) => row.change === "update").length,
    unchangedCount: rows.filter((row) => row.change === "unchanged").length,
    conflictCount: rows.filter((row) => row.change === "conflict").length,
    errorCount: rows.filter((row) => row.change === "error").length,
  };
}

function requireScopedClass(classRoom: ClassRoom | null): ScopedClassRoom {
  if (!classRoom?.academicYearId || !classRoom.gradeId || !classRoom.classNumber) {
    throw new Error("선택한 반은 scoped 학년도/학년 데이터가 아닙니다.");
  }
  return classRoom as ScopedClassRoom;
}

function validateScope(scope: StudentScopeInput) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년을 모두 지정해 주세요.");
}

export async function listScopedStudents(scope: StudentScopeInput): Promise<ScopedStudent[]> {
  validateScope(scope);
  const constraints = [where("academicYearId", "==", scope.academicYearId), where("gradeId", "==", scope.gradeId)];
  const snapshot = scope.classId
    ? await getDocs(query(collection(db, "students"), ...constraints, where("classId", "==", scope.classId), orderBy("studentNo")))
    : await getDocs(query(collection(db, "students"), ...constraints, orderBy("classId"), orderBy("studentNo")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ScopedStudent, "id">) }));
}

export async function getStudent(studentId: string): Promise<ScopedStudent | null> {
  const snapshot = await getDoc(doc(db, "students", studentId));
  if (!snapshot.exists()) return null;
  const student = { id: snapshot.id, ...(snapshot.data() as Omit<ScopedStudent, "id">) };
  return student.academicYearId && student.gradeId ? student : null;
}

export async function validateStudentClassScope(value: Pick<ScopedStudent, "academicYearId" | "gradeId" | "classId">): Promise<ScopedClassRoom> {
  validateScope(value);
  const classRoom = requireScopedClass(await getClass(value.classId));
  if (!classRoom.active) throw new Error("비활성 반에는 학생을 등록할 수 없습니다.");
  if (classRoom.academicYearId !== value.academicYearId || classRoom.gradeId !== value.gradeId) {
    throw new Error("학생의 학년도/학년과 반의 scope가 일치하지 않습니다.");
  }
  return classRoom;
}

function validateStudent(value: Omit<ScopedStudent, "id"> | ScopedStudent) {
  validateScope(value);
  if (!value.classId.trim()) throw new Error("반을 선택해 주세요.");
  if (!Number.isInteger(value.studentNo) || value.studentNo < 1) throw new Error("학번은 1 이상의 정수여야 합니다.");
  if (!value.name.trim()) throw new Error("학생 이름을 입력해 주세요.");
}

async function assertStudentNumberAvailable(value: Pick<ScopedStudent, "academicYearId" | "gradeId" | "classId" | "studentNo">, exceptId?: string) {
  const existing = await listScopedStudents(value);
  if (existing.some((student) => student.id !== exceptId && student.studentNo === value.studentNo)) {
    throw new Error("같은 학년도와 반에 이미 사용 중인 학번입니다.");
  }
}

export async function createStudent(value: Omit<ScopedStudent, "id">, actor: AuditActor): Promise<string> {
  validateStudent(value);
  await validateStudentClassScope(value);
  await assertStudentNumberAvailable(value);
  const ref = doc(collection(db, "students"));
  const next = { ...value, name: value.name.trim() };
  const batch = writeBatch(db);
  batch.set(ref, next);
  appendAuditLog(batch, { actor, action: "STUDENT_CREATED", targetType: "student", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, classId: next.classId, studentId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function updateStudent(value: ScopedStudent, actor: AuditActor, before: ScopedStudent) {
  validateStudent(value);
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeId !== before.gradeId) {
    throw new Error("학생 ID와 학년도/학년 scope는 변경할 수 없습니다.");
  }
  await validateStudentClassScope(value);
  await assertStudentNumberAvailable(value, value.id);
  const next = { classId: value.classId, studentNo: value.studentNo, name: value.name.trim(), active: value.active, updatedAt: serverTimestamp() };
  const batch = writeBatch(db);
  batch.update(doc(db, "students", value.id), next);
  appendAuditLog(batch, { actor, action: "STUDENT_UPDATED", targetType: "student", targetId: value.id, before, after: { ...before, ...next }, academicYearId: value.academicYearId, gradeId: value.gradeId, classId: value.classId, studentId: value.id });
  await batch.commit();
}

export async function deactivateStudent(studentId: string, actor: AuditActor) {
  const student = await getStudent(studentId);
  if (!student) throw new Error("학생을 찾을 수 없습니다.");
  if (!student.active) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "students", studentId), { active: false, updatedAt: serverTimestamp() });
  appendAuditLog(batch, { actor, action: "STUDENT_DEACTIVATED", targetType: "student", targetId: studentId, before: student, after: { ...student, active: false }, academicYearId: student.academicYearId, gradeId: student.gradeId, classId: student.classId, studentId });
  await batch.commit();
}

/** Adds immutable selected scope metadata after parse/normalize, before confirmation. */
export async function createScopedStudentImportPreview(scope: StudentScopeInput, summary: StudentImportSummary): Promise<ScopedStudentImportPreview> {
  const classes = await listClasses(scope.academicYearId, scope.gradeId);
  return buildScopedStudentImportPreview(scope, summary, classes);
}

export async function commitScopedStudentImport(preview: ScopedStudentImportPreview, actor: AuditActor) {
  validateScope(preview);
  if (preview.rows.some((row) => row.change === "error" || row.change === "conflict")) throw new Error("오류와 충돌을 해결한 후 적용해 주세요.");
  const classIds = [...new Set(preview.rows.filter((row) => row.change !== "unchanged").map((row) => row.classId))];
  await Promise.all(classIds.map((classId) => validateStudentClassScope({ ...preview, classId })));
  const changed = preview.rows.filter((row) => row.change !== "unchanged");
  const importNumbers = new Set<string>();
  for (const row of changed) {
    const key = `${row.classId}/${row.studentNo}`;
    if (importNumbers.has(key)) throw new Error("파일 내에 같은 반과 학번이 중복됩니다.");
    importNumbers.add(key);
    await assertStudentNumberAvailable({ ...preview, classId: row.classId, studentNo: row.studentNo }, row.existingStudent?.id);
  }
  const batch = writeBatch(db);
  for (const row of changed) {
    const ref = row.existingStudent?.id ? doc(db, "students", row.existingStudent.id) : doc(collection(db, "students"));
    batch.set(ref, { academicYearId: preview.academicYearId, gradeId: preview.gradeId, classId: row.classId, studentNo: row.studentNo, name: row.name.trim(), active: true, updatedAt: serverTimestamp() }, { merge: true });
  }
  appendAuditLog(batch, { actor, action: "STUDENT_IMPORT_APPLIED", targetType: "student_import", targetId: crypto.randomUUID(), after: { newCount: preview.newCount, updateCount: preview.updateCount }, source: "excel", batchId: crypto.randomUUID(), batchSize: changed.length, academicYearId: preview.academicYearId, gradeId: preview.gradeId });
  await batch.commit();
}
