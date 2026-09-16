import { Timestamp, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { EmergencyMode, OperationsSettings } from "../types/domain";

const EMERGENCY_MODES: EmergencyMode[] = ["NORMAL", "READ_ONLY", "ESSENTIAL_ONLY", "MAINTENANCE", "LOCKDOWN"];

export const DEFAULT_OPERATIONS_SETTINGS: OperationsSettings = {
  emergencyMode: "NORMAL",
  emergencyMessage: "",
  maintenance: {
    enabled: false,
    title: "",
    message: "",
    noticeFrom: null,
    startsAt: null,
    endsAt: null,
    bannerEnabled: true,
    popupEnabled: true,
  },
  updatedBy: "",
};

function isTimestampOrNull(value: unknown): value is Timestamp | null {
  return value === null || value instanceof Timestamp;
}

/** Mirrors the Rules contract before a privileged client submits an operations change. */
export function validateOperationsSettings(value: OperationsSettings): string | null {
  if (!EMERGENCY_MODES.includes(value.emergencyMode)) return "지원하지 않는 비상 운영 모드입니다.";
  if (typeof value.emergencyMessage !== "string" || value.emergencyMessage.length > 1000) return "비상 안내 문구가 올바르지 않습니다.";

  const maintenance = value.maintenance;
  if (!maintenance || typeof maintenance.enabled !== "boolean" || typeof maintenance.title !== "string" || typeof maintenance.message !== "string" || maintenance.title.length > 200 || maintenance.message.length > 2000 || typeof maintenance.bannerEnabled !== "boolean" || typeof maintenance.popupEnabled !== "boolean") return "점검 정보가 올바르지 않습니다.";
  if (![maintenance.noticeFrom, maintenance.startsAt, maintenance.endsAt].every(isTimestampOrNull)) return "점검 시각은 Timestamp 또는 null이어야 합니다.";
  if (maintenance.enabled) {
    if (!(maintenance.noticeFrom instanceof Timestamp && maintenance.startsAt instanceof Timestamp && maintenance.endsAt instanceof Timestamp)) return "활성 점검에는 안내, 시작, 종료 시각이 필요합니다.";
    if (!(maintenance.noticeFrom.toMillis() <= maintenance.startsAt.toMillis() && maintenance.startsAt.toMillis() < maintenance.endsAt.toMillis())) return "점검 시각 순서가 올바르지 않습니다.";
  }
  return null;
}

export async function getOperationsSettings(): Promise<OperationsSettings> {
  const snap = await getDoc(doc(db, "settings", "operations"));
  return snap.exists() ? (snap.data() as OperationsSettings) : DEFAULT_OPERATIONS_SETTINGS;
}

export async function saveOperationsSettings(value: OperationsSettings, actorUid: string): Promise<void> {
  const error = validateOperationsSettings(value);
  if (error) throw new Error(error);
  const batch = writeBatch(db);
  batch.set(doc(db, "settings", "operations"), { ...value, updatedBy: actorUid, updatedAt: serverTimestamp() });
  await batch.commit();
}
