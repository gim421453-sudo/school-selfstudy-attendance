import { collection, doc, getDoc, getDocs, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AcademicYear } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

function validateAcademicYear(value: AcademicYear) {
  if (!value.id.trim() || value.id.includes("/")) throw new Error("학년도 ID를 입력해 주세요.");
  if (!value.displayName.trim()) throw new Error("학년도 표시명을 입력해 주세요.");
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const snapshot = await getDocs(query(collection(db, "academicYears"), orderBy("displayName")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AcademicYear, "id">) }));
}

export async function getAcademicYear(id: string): Promise<AcademicYear | null> {
  const snapshot = await getDoc(doc(db, "academicYears", id));
  return snapshot.exists() ? { id: snapshot.id, ...(snapshot.data() as Omit<AcademicYear, "id">) } : null;
}

export async function getCurrentAcademicYear(): Promise<AcademicYear | null> {
  const years = await listAcademicYears();
  return years.find((year) => year.isCurrent) ?? null;
}

export async function createAcademicYear(value: AcademicYear, actor: AuditActor) {
  validateAcademicYear(value);
  if (await getAcademicYear(value.id)) throw new Error("이미 존재하는 학년도 ID입니다.");
  const batch = writeBatch(db);
  batch.set(doc(db, "academicYears", value.id), {
    displayName: value.displayName.trim(),
    active: value.active,
    isCurrent: false,
  });
  appendAuditLog(batch, {
    actor,
    action: "ACADEMIC_YEAR_CREATED",
    targetType: "academic_year",
    targetId: value.id,
    after: { ...value, displayName: value.displayName.trim(), isCurrent: false },
  });
  await batch.commit();
}

export async function updateAcademicYear(value: AcademicYear, actor: AuditActor, before: AcademicYear) {
  validateAcademicYear(value);
  if (value.id !== before.id) throw new Error("학년도 ID는 변경할 수 없습니다.");
  if (before.isCurrent && !value.active) throw new Error("현재 학년도를 비활성화하려면 먼저 다른 학년도를 현재로 선택해 주세요.");
  const next = { displayName: value.displayName.trim(), active: value.active };
  const batch = writeBatch(db);
  batch.update(doc(db, "academicYears", value.id), next);
  appendAuditLog(batch, { actor, action: "ACADEMIC_YEAR_UPDATED", targetType: "academic_year", targetId: value.id, before, after: { ...before, ...next } });
  await batch.commit();
}

/** Atomically clears every existing current flag before selecting the new year. */
export async function setCurrentAcademicYear(id: string, actor: AuditActor) {
  const years = await listAcademicYears();
  const next = years.find((year) => year.id === id);
  if (!next) throw new Error("선택한 학년도를 찾을 수 없습니다.");
  if (!next.active) throw new Error("활성 학년도만 현재 학년도로 선택할 수 있습니다.");
  const previous = years.find((year) => year.isCurrent) ?? null;
  const batch = writeBatch(db);
  years.filter((year) => year.isCurrent && year.id !== id).forEach((year) => {
    batch.update(doc(db, "academicYears", year.id), { isCurrent: false });
  });
  batch.update(doc(db, "academicYears", id), { isCurrent: true });
  appendAuditLog(batch, {
    actor,
    action: "CURRENT_ACADEMIC_YEAR_CHANGED",
    targetType: "academic_year",
    targetId: id,
    before: previous ? { id: previous.id, isCurrent: true } : null,
    after: { id, isCurrent: true },
  });
  await batch.commit();
}
