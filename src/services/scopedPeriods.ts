import { collection, doc, getDoc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Period } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { DEFAULT_OPERATING_DAYS, periodScheduleForDay } from "../domain/schedule";

const legacyOperatingDays: readonly number[] = DEFAULT_OPERATING_DAYS;

export interface PeriodScope { academicYearId: string; gradeId: string; }
export interface ScopedPeriod extends Period { academicYearId: string; gradeId: string; }

function validateScope(scope: PeriodScope) {
  if (!scope.academicYearId.trim() || !scope.gradeId.trim()) throw new Error("학년도와 학년을 지정해 주세요.");
}

export function validateScopedPeriod(value: Omit<ScopedPeriod, "id"> | ScopedPeriod, existing: ScopedPeriod[]) {
  validateScope(value);
  validateScheduleByDay(value.scheduleByDay);
  const operatingDays = value.operatingDays ?? legacyOperatingDays;
  if (!Array.isArray(operatingDays) || operatingDays.length === 0 || operatingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) || new Set(operatingDays).size !== operatingDays.length) throw new Error("운영 요일을 한 개 이상 선택하세요.");
  if (!value.name.trim()) throw new Error("교시명은 비어 있을 수 없습니다.");
  if (value.periodType !== undefined && value.periodType !== "SELF_STUDY" && value.periodType !== "BREAK") throw new Error("교시 유형이 올바르지 않습니다.");
  if (!Number.isInteger(value.order) || value.order < 1) throw new Error("순서는 1 이상이어야 합니다.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.endTime)) throw new Error("시간은 HH:mm 형식이어야 합니다.");
  if (value.startTime >= value.endTime) throw new Error("시작 시간은 종료 시간보다 이르어야 합니다.");
  for (const day of operatingDays) {
    const current = periodScheduleForDay(value, day);
    if (!current.enabled) continue;
    if (existing.some((period) => period.id !== ("id" in value ? value.id : undefined) && periodScheduleForDay(period, day).enabled && periodScheduleForDay(period, day).order === current.order && periodScheduleForDay(period, day).periodType === current.periodType)) throw new Error("같은 요일에 이미 사용 중인 시간 순서입니다.");
    const overlap = existing.some((period) => {
      if (period.id === ("id" in value ? value.id : undefined)) return false;
      const compared = periodScheduleForDay(period, day);
      return compared.enabled && current.startTime < compared.endTime && compared.startTime < current.endTime;
    });
    if (overlap) throw new Error(`${day + 1}요일 시간표의 다른 시간과 겹칩니다.`);
  }
}

function validateScheduleByDay(scheduleByDay: ScopedPeriod["scheduleByDay"]) {
  if (!scheduleByDay) return;
  for (const [day, schedule] of Object.entries(scheduleByDay)) {
    if (!/^[0-6]$/.test(day) || !schedule || typeof schedule.enabled !== "boolean" || (schedule.name !== undefined && (typeof schedule.name !== "string" || !schedule.name.trim())) || (schedule.order !== undefined && (!Number.isInteger(schedule.order) || schedule.order < 1)) || (schedule.periodType !== undefined && schedule.periodType !== "SELF_STUDY" && schedule.periodType !== "BREAK") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.endTime) || schedule.startTime >= schedule.endTime) throw new Error("요일별 시간표 정보가 올바르지 않습니다.");
  }
}

export async function listScopedPeriods(academicYearId: string, gradeId: string): Promise<ScopedPeriod[]> {
  validateScope({ academicYearId, gradeId });
  const snapshot = await getDocs(query(collection(db, "periods"), where("academicYearId", "==", academicYearId), where("gradeId", "==", gradeId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ScopedPeriod, "id">) })).sort((left, right) => left.order - right.order);
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
  const next = { ...value, name: value.name.trim(), periodType: value.periodType ?? "SELF_STUDY", operatingDays: value.operatingDays ?? [...DEFAULT_OPERATING_DAYS] };
  const batch = writeBatch(db);
  batch.set(ref, next);
  appendAuditLog(batch, { actor, action: "PERIOD_CREATED", targetType: "period", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId, periodId: ref.id });
  await batch.commit();
  return ref.id;
}

export async function updatePeriod(value: ScopedPeriod, actor: AuditActor, before: ScopedPeriod) {
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.gradeId !== before.gradeId) throw new Error("교시 ID와 scope는 변경할 수 없습니다.");
  validateScopedPeriod(value, await listScopedPeriods(value.academicYearId, value.gradeId));
  const next = { name: value.name.trim(), order: value.order, startTime: value.startTime, endTime: value.endTime, active: value.active, periodType: value.periodType ?? "SELF_STUDY", operatingDays: value.operatingDays ?? [...DEFAULT_OPERATING_DAYS], ...(value.scheduleByDay ? { scheduleByDay: value.scheduleByDay } : {}) };
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
