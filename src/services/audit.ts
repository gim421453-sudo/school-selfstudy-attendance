import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, Timestamp, where, writeBatch, type WriteBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AuditLog } from "../types/domain";

export interface AuditActor {
  uid: string;
  name: string;
}

export interface AuditEvent {
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string;
  before?: object | null;
  after?: object | null;
  source?: "manual" | "excel" | "system";
  batchId?: string;
  batchSize?: number;
  academicYearId?: string;
  gradeId?: string;
  classId?: string;
  studentId?: string;
  periodId?: string;
  selfStudyGroupId?: string;
  dutyDate?: string;
}

export function auditEventData(event: AuditEvent) {
  return {
    actorUid: event.actor.uid,
    actorName: event.actor.name,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    before: event.before ?? null,
    after: event.after ?? null,
    source: event.source ?? "manual",
    ...(event.batchId ? { batchId: event.batchId } : {}),
    ...(event.batchSize ? { batchSize: event.batchSize } : {}),
    ...(event.academicYearId ? { academicYearId: event.academicYearId } : {}),
    ...(event.gradeId ? { gradeId: event.gradeId } : {}),
    ...(event.classId ? { classId: event.classId } : {}),
    ...(event.studentId ? { studentId: event.studentId } : {}),
    ...(event.periodId ? { periodId: event.periodId } : {}),
    ...(event.selfStudyGroupId ? { selfStudyGroupId: event.selfStudyGroupId } : {}),
    ...(event.dutyDate ? { dutyDate: event.dutyDate } : {}),
    timestamp: serverTimestamp(),
  };
}

export function appendAuditLog(batch: WriteBatch, event: AuditEvent) {
  batch.set(doc(collection(db, "auditLogs")), auditEventData(event));
}

export async function writeAuditLog(event: AuditEvent) {
  const batch = writeBatch(db);
  appendAuditLog(batch, event);
  await batch.commit();
}

export async function listAuditLogs(start: Date, end: Date): Promise<AuditLog[]> {
  const snapshot = await getDocs(query(collection(db, "auditLogs"), where("timestamp", ">=", Timestamp.fromDate(start)), where("timestamp", "<=", Timestamp.fromDate(end)), orderBy("timestamp", "desc"), limit(500)));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<AuditLog, "id">) }));
}
