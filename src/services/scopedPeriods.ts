import { collection, doc, getDoc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Period } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export interface PeriodScope { academicYearId: string; gradeId: string; }
export interface ScopedPeriod extends Period { academicYearId: string; gradeId: string; }

function validateScope(scope: PeriodScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년을 지정해 주세요.");
}

export function validateScopedPeriod(value: Omit<ScopedPeriod, "id"> | ScopedPeriod, existing: ScopedPeriod[]) {
  validateScope(value);
  if (!value.name.trim()) throw new Error("교시명은 비어 있을 수 없습니다.");
  if (!Number.isInteger(value.order) || value.order < 1) throw new Error("순서는 1 이상이어야 합니다.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime)) throw new Error("시간은 HH:mm 형식이어야 합니다.");
  if (value.startTime >= value.endTime) throw new Error("시작 시간은 종료 시간보다 이르어야 합니다.");
  if (existing.some((period) => period.id !== ("id" in value ? value.id : undefined) && period.order === value.order)) throw new Error("같은 scope에 이미 사용 중인 교시 순서입니다.");
}

export async function listScopedPeriods(academicYearId: string, gradeId: string): Promise<ScopedPeriod[]> {
  validateScope({ academicYearId, gradeId });
  const snapshot = await getDocs(query(collection(db, "periods"), where("academicYearId", "==", academicYearId), where("gradeId", "==", gradeId), orderBy("order")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ScopedPeriod, "id">) }));
}

export async function getScopedPeriod(periodId: string): Promise<ScopedPeriod | null> {
  const snapshot = await getDoc(doc(db, "periods", periodId));
  if (!snapshot.exists()) return null;
  const period = { id: snapshot.id, ...(snapshot.data() as Omit<ScopedPeriod, "id">) };
  return period.academicYearId && period.gradeId ? period : null;
}

export async function createPeriod(value: Omit<ScopedPeriod, "id">, actor: AuditActor): Promise<string> {
  const existing = await listScopedPeriods(value.academicYearId, value.gradeId);
  validateScopedPeriod(value, existing);
  const ref = doc(collection(db, "periods"));
  const next = { ...value, name: value.name.trim() };
  const batch = writeBatch(db);
  batch.set(ref, next);
  appendAuditLog(batch, { actor, action: "PERIOD_CREATED", targetType: "period", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, periodId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function updatePeriod(value: ScopedPeriod, actor: AuditActor, before: ScopedPeriod) {
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeId !== before.gradeId) throw new Error("교시 ID와 scope는 변경할 수 없습니다.");
  validateScopedPeriod(value, await listScopedPeriods(value.academicYearId, value.gradeId));
  const next = { name: value.name.trim(), order: value.order, startTime: value.startTime, endTime: value.endTime, active: value.active };
  const batch = writeBatch(db);
  batch.update(doc(db, "periods", value.id), next);
  appendAuditLog(batch, { actor, action: "PERIOD_UPDATED", targetType: "period", targetId: value.id, before, after: { ...before, ...next }, academicYearId: value.academicYearId, gradeId: value.gradeId, periodId: value.id });
  await batch.commit();
}

export async function deactivatePeriod(periodId: string, actor: AuditActor) {
  const period = await getScopedPeriod(periodId);
  if (!period) throw new Error("교시를 찾을 수 없습니다.");
  if (!period.active) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "periods", periodId), { active: false });
  appendAuditLog(batch, { actor, action: "PERIOD_UPDATED", targetType: "period", targetId: periodId, before: period, after: { ...period, active: false }, academicYearId: period.academicYearId, gradeId: period.gradeId, periodId });
  await batch.commit();
}

// Scoped service API aliases; legacy masterData.listPeriods remains unchanged.
export const listPeriods = listScopedPeriods;
export const getPeriod = getScopedPeriod;
