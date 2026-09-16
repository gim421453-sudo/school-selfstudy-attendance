import { collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { AppUser, PendingUser } from "../types/domain";
import { appendAuditLog, type AuditActor } from "./audit";

export async function ensurePendingUser(user: User): Promise<PendingUser | null> {
  const account = await getDoc(doc(db, "users", user.uid));
  if (account.exists()) return null;
  const ref = doc(db, "pendingUsers", user.uid);
  const existing = await getDoc(ref);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.update(ref, { email: user.email ?? "", displayName: user.displayName ?? "", lastLoginAt: serverTimestamp() });
  } else {
    batch.set(ref, { uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "", provider: "google", createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() });
  }
  await batch.commit();
  return { uid: user.uid, email: user.email ?? "", displayName: user.displayName ?? "", provider: "google", ...(existing.exists() ? existing.data() as Omit<PendingUser, "uid" | "email" | "displayName" | "provider"> : {}) };
}

export async function getPendingUser(uid: string): Promise<PendingUser | null> {
  const snap = await getDoc(doc(db, "pendingUsers", uid));
  return snap.exists() ? (snap.data() as PendingUser) : null;
}

export async function listPendingUsers(): Promise<PendingUser[]> {
  const snap = await getDocs(query(collection(db, "pendingUsers"), orderBy("createdAt")));
  return snap.docs.map((item) => item.data() as PendingUser);
}

export async function approvePendingUser(pending: PendingUser, actor: AuditActor) {
  const roles: AppUser["roles"] = ["teacher"];
  const batch = writeBatch(db);
  batch.set(doc(db, "users", pending.uid), { email: pending.email, displayName: pending.displayName, globalRoles: ["teacher"], roles, active: true });
  batch.delete(doc(db, "pendingUsers", pending.uid));
  appendAuditLog(batch, { actor, action: "USER_APPROVED", targetType: "pending_user", targetId: pending.uid, before: { email: pending.email, displayName: pending.displayName, provider: pending.provider }, after: { email: pending.email, displayName: pending.displayName, globalRoles: ["teacher"], active: true } });
  await batch.commit();
}

export async function rejectPendingUser(pending: PendingUser, actor: AuditActor) {
  const batch = writeBatch(db);
  batch.delete(doc(db, "pendingUsers", pending.uid));
  appendAuditLog(batch, { actor, action: "USER_PENDING_REJECTED", targetType: "pending_user", targetId: pending.uid, before: { email: pending.email, displayName: pending.displayName, provider: pending.provider }, after: null });
  await batch.commit();
}
