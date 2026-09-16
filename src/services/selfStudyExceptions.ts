import { collection, doc, getDoc, getDocs, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { isSelfStudyDate } from "../domain/schedule";
import type { SelfStudyException } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export async function getSelfStudyException(date: string): Promise<SelfStudyException | null> {
  const snap = await getDoc(doc(db, "selfStudyExceptions", date));
  return snap.exists() ? (snap.data() as SelfStudyException) : null;
}

export async function listSelfStudyExceptions(): Promise<SelfStudyException[]> {
  const snap = await getDocs(query(collection(db, "selfStudyExceptions"), orderBy("date")));
  return snap.docs.map((item) => item.data() as SelfStudyException);
}

export async function assertOperationalSelfStudyDate(date: string): Promise<void> {
  const exception = await getSelfStudyException(date);
  if (!isSelfStudyDate(date, exception)) throw new Error(exception?.enabled ? exception.reason : "\uC790\uC728\uD559\uC2B5 \uC6B4\uC601\uC77C\uC774 \uC544\uB2D9\uB2C8\uB2E4.");
}

export async function saveSelfStudyException(value: SelfStudyException, actor: AuditActor, before?: SelfStudyException | null) {
  const batch = writeBatch(db);
  batch.set(doc(db, "selfStudyExceptions", value.date), value, { merge: true });
  appendAuditLog(batch, { actor, action: before ? "SELF_STUDY_EXCEPTION_UPDATED" : "SELF_STUDY_EXCEPTION_CREATED", targetType: "self_study_exception", targetId: value.date, before: before ?? null, after: value });
  await batch.commit();
}
