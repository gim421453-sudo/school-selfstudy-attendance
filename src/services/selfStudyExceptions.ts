import { collection, doc, getDoc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore";
import { makeSelfStudyExceptionId } from "../domain/ids";
import { isScopedSelfStudyDate, isSelfStudyDate } from "../domain/schedule";
import { db } from "../lib/firebase";
import type { SelfStudyException } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export interface SelfStudyExceptionScope { academicYearId: string; gradeId: string; }
const active = (value: SelfStudyException) => value.active === true || (value.active === undefined && value.enabled === true);

function validate(value: SelfStudyException) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date) || !value.academicYearId || !value.scopeType || !value.reason?.trim() || value.reason.trim().length > 500) throw new Error("자습 제외일 정보가 올바르지 않습니다.");
  if (value.scopeType === "school" && value.gradeId !== null) throw new Error("학교 전체 제외일에는 학년을 지정할 수 없습니다.");
  if (value.scopeType === "grade" && !value.gradeId) throw new Error("학년 제외일에는 학년을 지정해야 합니다.");
  if (value.periodIds && (value.periodIds.length === 0 || value.periodIds.some((id) => !id.trim()) || new Set(value.periodIds).size !== value.periodIds.length)) throw new Error("제외 교시 정보가 올바르지 않습니다.");
}

/** Legacy date-level reads remain available for v0.6 pages. */
export async function getSelfStudyException(date: string): Promise<SelfStudyException | null> {
  const snap = await getDoc(doc(db, "selfStudyExceptions", date));
  return snap.exists() ? (snap.data() as SelfStudyException) : null;
}

export async function listSelfStudyExceptions(scope?: SelfStudyExceptionScope): Promise<SelfStudyException[]> {
  if (!scope) {
    const snap = await getDocs(query(collection(db, "selfStudyExceptions"), orderBy("date")));
    return snap.docs.map((item) => item.data() as SelfStudyException);
  }
  const [school, grade] = await Promise.all([
    getDocs(query(collection(db, "selfStudyExceptions"), where("academicYearId", "==", scope.academicYearId), where("scopeType", "==", "school"), where("gradeId", "==", null), orderBy("date"))),
    getDocs(query(collection(db, "selfStudyExceptions"), where("academicYearId", "==", scope.academicYearId), where("scopeType", "==", "grade"), where("gradeId", "==", scope.gradeId), orderBy("date"))),
  ]);
  return [...school.docs, ...grade.docs]
    .map((item) => item.data() as SelfStudyException)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function getApplicableSelfStudyExceptions(scope: SelfStudyExceptionScope, date: string, periodId?: string): Promise<SelfStudyException[]> {
  return (await listSelfStudyExceptions(scope)).filter((item) => item.date === date && active(item) && (!item.periodIds || !periodId || item.periodIds.includes(periodId)));
}

export async function assertOperationalSelfStudyDate(scope: SelfStudyExceptionScope, date: string, periodId?: string): Promise<void>;
export async function assertOperationalSelfStudyDate(date: string): Promise<void>;
export async function assertOperationalSelfStudyDate(scopeOrDate: SelfStudyExceptionScope | string, suppliedDate?: string, periodId?: string): Promise<void> {
  if (typeof scopeOrDate === "string") {
    const legacy = await getSelfStudyException(scopeOrDate);
    if (!isSelfStudyDate(scopeOrDate, legacy)) throw new Error(legacy?.reason || "자습 운영 제외일입니다.");
    return;
  }
  const scope = scopeOrDate; const date = suppliedDate!;
  const exceptions = await getApplicableSelfStudyExceptions(scope, date, periodId);
  if (!isScopedSelfStudyDate(date, exceptions)) throw new Error(exceptions[0]?.reason || "자습 운영 제외일입니다.");
}

export async function saveSelfStudyException(value: SelfStudyException, actor: AuditActor, before?: SelfStudyException | null) {
  validate(value);
  const next = { ...value, reason: value.reason.trim(), active: value.active !== false };
  const id = makeSelfStudyExceptionId(next.academicYearId!, next.scopeType!, next.gradeId ?? null, next.date);
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyExceptions", id), next, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "SELF_STUDY_EXCEPTION_UPDATED" : "SELF_STUDY_EXCEPTION_CREATED", targetType: "self_study_exception", targetId: id, before: before ?? null, after: next, academicYearId: next.academicYearId, ...(next.gradeId ? { gradeId: next.gradeId } : {}), dutyDate: next.date });
  await batch.commit();
}

export async function deactivateSelfStudyException(value: SelfStudyException, actor: AuditActor) {
  if (!value.academicYearId || !value.scopeType || !active(value)) return;
  const id = makeSelfStudyExceptionId(value.academicYearId, value.scopeType, value.gradeId ?? null, value.date);
  const batch = writeBatch(db);
  batch.update(doc(db, "selfStudyExceptions", id), { active: false });
  appendAuditLog(batch, { actor, action: "SELF_STUDY_EXCEPTION_DEACTIVATED", targetType: "self_study_exception", targetId: id, before: value, after: { ...value, active: false }, academicYearId: value.academicYearId, ...(value.gradeId ? { gradeId: value.gradeId } : {}), dutyDate: value.date });
  await batch.commit();
}
