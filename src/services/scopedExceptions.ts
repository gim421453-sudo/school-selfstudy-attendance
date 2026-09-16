import { collection, doc, getDoc, getDocs, orderBy, query, where, writeBatch } from "firebase/firestore";
import { isScopedSelfStudyDate } from "../domain/schedule";
import { db } from "../lib/firebase";
import type { SelfStudyException, SelfStudyExceptionReasonType } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";
import { getGrade } from "./grades";

export interface ExceptionScope { academicYearId: string; gradeId?: string | null; }
export interface ScopedException extends SelfStudyException { id: string; academicYearId: string; scopeType: "school" | "grade"; active: boolean; }
export interface ExceptionRange { start: string; end: string; }

function validateScope(value: Pick<ScopedException, "academicYearId" | "gradeId" | "scopeType">) {
  if (!value.academicYearId.trim()) throw new Error("학년도를 지정해 주세요.");
  if (value.scopeType === "school" && value.gradeId != null) throw new Error("학교 전체 예외일은 학년을 지정할 수 없습니다.");
  if (value.scopeType === "grade" && !value.gradeId) throw new Error("학년 예외일은 학년을 지정해 주세요.");
}

async function validateException(value: Omit<ScopedException, "id"> | ScopedException) {
  validateScope(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.date)) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  const reasons: SelfStudyExceptionReasonType[] = ["holiday", "exam", "school_event", "manual"];
  if (!reasons.includes(value.reasonType)) throw new Error("알 수 없는 예외일 사유입니다.");
  if (!value.reason.trim()) throw new Error("예외일 사유를 입력해 주세요.");
  if (value.scopeType === "grade") {
    const grade = await getGrade(value.gradeId!);
    if (!grade || grade.academicYearId !== value.academicYearId) throw new Error("학년은 선택한 학년도에 속해야 합니다.");
  }
}

function mapException(id: string, data: Omit<ScopedException, "id">): ScopedException {
  return { id, ...data, active: data.active === true };
}

export async function listSchoolExceptions(academicYearId: string): Promise<ScopedException[]> {
  const snapshot = await getDocs(query(collection(db, "selfStudyExceptions"), where("academicYearId", "==", academicYearId), where("scopeType", "==", "school"), orderBy("date")));
  return snapshot.docs.map((item) => mapException(item.id, item.data() as Omit<ScopedException, "id">));
}

export async function listGradeExceptions(academicYearId: string, gradeId: string): Promise<ScopedException[]> {
  const snapshot = await getDocs(query(collection(db, "selfStudyExceptions"), where("academicYearId", "==", academicYearId), where("scopeType", "==", "grade"), where("gradeId", "==", gradeId), orderBy("date")));
  return snapshot.docs.map((item) => mapException(item.id, item.data() as Omit<ScopedException, "id">));
}

export async function getApplicableExceptions(academicYearId: string, gradeId: string, range: ExceptionRange): Promise<ScopedException[]> {
  const [school, grade] = await Promise.all([listSchoolExceptions(academicYearId), listGradeExceptions(academicYearId, gradeId)]);
  return [...school, ...grade].filter((exception) => exception.date >= range.start && exception.date <= range.end && exception.active);
}

export async function assertScopedSelfStudyDate(academicYearId: string, gradeId: string, date: string) {
  const exceptions = await getApplicableExceptions(academicYearId, gradeId, { start: date, end: date });
  if (!isScopedSelfStudyDate(date, exceptions)) throw new Error("해당 날짜는 자율학습 운영일이 아닙니다.");
}

export async function getScopedException(id: string): Promise<ScopedException | null> {
  const snapshot = await getDoc(doc(db, "selfStudyExceptions", id));
  return snapshot.exists() ? mapException(snapshot.id, snapshot.data() as Omit<ScopedException, "id">) : null;
}

export async function createException(value: Omit<ScopedException, "id">, actor: AuditActor): Promise<string> {
  await validateException(value);
  const ref = doc(collection(db, "selfStudyExceptions"));
  const next = { ...value, gradeId: value.scopeType === "school" ? null : value.gradeId, reason: value.reason.trim(), active: value.active };
  const batch = writeBatch(db);
  batch.set(ref, next);
  appendAuditLog(batch, { actor, action: "SELF_STUDY_EXCEPTION_CREATED", targetType: "self_study_exception", targetId: ref.id, after: next, academicYearId: next.academicYearId, gradeId: next.gradeId ?? undefined });
  await batch.commit();
  return ref.id;
}

export async function updateException(value: ScopedException, actor: AuditActor, before: ScopedException) {
  if (value.id !== before.id || value.academicYearId !== before.academicYearId || value.scopeType !== before.scopeType || value.gradeId !== before.gradeId) throw new Error("예외일의 ID와 scope는 변경할 수 없습니다.");
  await validateException(value);
  const next = { date: value.date, reasonType: value.reasonType, reason: value.reason.trim(), active: value.active };
  const batch = writeBatch(db);
  batch.update(doc(db, "selfStudyExceptions", value.id), next);
  appendAuditLog(batch, { actor, action: "SELF_STUDY_EXCEPTION_UPDATED", targetType: "self_study_exception", targetId: value.id, before, after: { ...before, ...next }, academicYearId: value.academicYearId, gradeId: value.gradeId ?? undefined });
  await batch.commit();
}

export async function deactivateException(id: string, actor: AuditActor) {
  const exception = await getScopedException(id);
  if (!exception) throw new Error("예외일을 찾을 수 없습니다.");
  if (!exception.active) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "selfStudyExceptions", id), { active: false });
  appendAuditLog(batch, { actor, action: "SELF_STUDY_EXCEPTION_DEACTIVATED", targetType: "self_study_exception", targetId: id, before: exception, after: { ...exception, active: false }, academicYearId: exception.academicYearId, gradeId: exception.gradeId ?? undefined });
  await batch.commit();
}
