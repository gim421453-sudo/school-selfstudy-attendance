import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AccessSettings } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export const DEFAULT_ACCESS_SETTINGS: AccessSettings = {
  statsVisibility: "grade_admin_only",
  homeroomStatsScope: "own_class",
};

export async function getAccessSettings(): Promise<AccessSettings> {
  const snap = await getDoc(doc(db, "settings", "access"));
  return snap.exists() ? (snap.data() as AccessSettings) : DEFAULT_ACCESS_SETTINGS;
}

export async function saveAccessSettings(value: AccessSettings, actor: AuditActor, before: AccessSettings) {
  const batch = writeBatch(db);
  batch.set(doc(db, "settings", "access"), value, { merge: true });
  appendAuditLog(batch, {
    actor,
    action: "STATISTICS_ACCESS_POLICY_CHANGED",
    targetType: "settings",
    targetId: "access",
    before: { statsVisibility: before.statsVisibility, homeroomStatsScope: before.homeroomStatsScope },
    after: { statsVisibility: value.statsVisibility, homeroomStatsScope: value.homeroomStatsScope },
  });
  await batch.commit();
}
