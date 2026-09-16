import { collection, doc, getDoc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore";
import { makeGradeId } from "../domain/ids";
import { db } from "../lib/firebase";
import type { Grade } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

function validateGrade(value: Grade) {
  if (!value.academicYearId.trim()) throw new Error("학년도를 선택해 주세요.");
  if (!Number.isInteger(value.gradeNumber) || value.gradeNumber < 1) throw new Error("학년은 1 이상의 정수여야 합니다.");
  if (!value.displayName.trim()) throw new Error("학년 표시명을 입력해 주세요.");
}

export async function listGrades(academicYearId: string): Promise<Grade[]> {
  const snapshot = await getDocs(query(collection(db, "grades"), where("academicYearId", "==", academicYearId), orderBy("gradeNumber")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Grade, "id">) }));
}

export async function getGrade(gradeId: string): Promise<Grade | null> {
  const snapshot = await getDoc(doc(db, "grades", gradeId));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<Grade, "id">) } : null;
}

export async function createGrade(value: Omit<Grade, "id">, actor: AuditActor): Promise<string> {
  validateGrade({ ...value, id: makeGradeId(value.academicYearId, value.gradeNumber) });
  const id = makeGradeId(value.academicYearId, value.gradeNumber);
  if (await getGrade(id)) throw new Error("이미 존재하는 학년입니다.");
  const next = { ...value, displayName: value.displayName.trim() };
  const batch = writeBatch(db);
  batch.set(doc(db, "grades", id), next);
  appendAuditLog(batch, { actor, action: "GRADE_CREATED", targetType: "grade", targetId: id, after: { id, ...next } });
  await batch.commit();
  return id;
}

export async function updateGrade(value: Grade, actor: AuditActor, before: Grade) {
  validateGrade(value);
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeNumber !== before.gradeNumber) {
    throw new Error("학년 ID, 학년도, 학년 번호는 변경할 수 없습니다.");
  }
  const next = { displayName: value.displayName.trim(), active: value.active };
  const batch = writeBatch(db);
  batch.update(doc(db, "grades", value.id), next);
  appendAuditLog(batch, { actor, action: "GRADE_UPDATED", targetType: "grade", targetId: value.id, before, after: { ...before, ...next } });
  await batch.commit();
}
