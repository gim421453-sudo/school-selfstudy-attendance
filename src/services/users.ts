import { collection, doc, getDoc, getDocs, orderBy, query, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { AppUser, UserRole } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

function normalizeAppUser(uid: string, data: Omit<AppUser, "uid" | "roles"> & { roles?: UserRole[] }): AppUser {
  const legacyRoles = data.roles ?? [];
  const globalRoles = data.globalRoles ?? legacyRoles.filter((role): role is "teacher" | "system_owner" => role === "teacher" || role === "system_owner");
  return { ...data, uid, roles: legacyRoles, globalRoles };
}

export async function getAppUser(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return normalizeAppUser(snap.id, snap.data() as Omit<AppUser, "uid" | "roles"> & { roles?: UserRole[] });
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(query(collection(db, "users"), orderBy("displayName")));
  return snap.docs.map((d) => normalizeAppUser(d.id, d.data() as Omit<AppUser, "uid" | "roles"> & { roles?: UserRole[] }));
}

export async function updateUserAccount(user: AppUser, values: Partial<Pick<AppUser, "active" | "roles" | "displayName" | "homeroomClassId">>, actor: AuditActor) {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", user.uid), values, { merge: true });
  const action = values.roles ? "USER_ROLE_UPDATE" : values.active !== undefined ? (values.active ? "USER_ACTIVATE" : "USER_DEACTIVATE") : "USER_UPDATE";
  appendAuditLog(batch, { actor, action, targetType: "user", targetId: user.uid, before: { active: user.active, roles: user.roles, homeroomClassId: user.homeroomClassId ?? null }, after: values });
  await batch.commit();
}
