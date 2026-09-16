import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
let env: RulesTestEnvironment;
const user = (uid: string, roles: string[], extras = {}) => ({ email: uid + "@example.com", displayName: uid, roles, active: true, ...extras });

suite("Firestore security rules", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({ projectId: "school-selfstudy-attendance-rules", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
  });
  beforeEach(async () => {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "teacher"), user("teacher", ["teacher"])),
        setDoc(doc(db, "users", "dutyTeacher"), user("dutyTeacher", ["teacher"])),
        setDoc(doc(db, "users", "admin"), user("admin", ["teacher", "grade_admin"])),
        setDoc(doc(db, "users", "homeroom"), user("homeroom", ["teacher", "homeroom_teacher"], { homeroomClassId: "2-1" })),
        setDoc(doc(db, "users", "owner"), user("owner", ["system_owner"])),
        setDoc(doc(db, "students", "s1"), { classId: "2-1", studentNo: 1, name: "Student", active: true }),
        setDoc(doc(db, "periods", "p1"), { name: "P1", order: 1, active: true }),
        setDoc(doc(db, "classes", "2-1"), { grade: 2, classNo: 1, active: true }),
        setDoc(doc(db, "dutyAssignments", "2026-09-15"), { date: "2026-09-15", periods: { p1: { teacherUid: "dutyTeacher", teacherName: "Duty", editableFrom: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")) }, p2: { teacherUid: "teacher", teacherName: "Teacher", editableFrom: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")) } } }),
        setDoc(doc(db, "statistics", "all"), { total: 1 }),
        setDoc(doc(db, "settings", "access"), { statsVisibility: "grade_admin_only", homeroomStatsScope: "own_class" }),
        setDoc(doc(db, "auditLogs", "seed"), { actorUid: "admin", actorName: "admin", action: "SEED", targetType: "system", targetId: "seed", timestamp: new Date() }),
      ]);
    });
  });
  afterAll(async () => { await env.cleanup(); });

  it("denies every protected collection to an unauthenticated user", async () => {
    const db = env.unauthenticatedContext().firestore();
    await Promise.all([
      assertFails(getDoc(doc(db, "users", "teacher"))),
      assertFails(getDoc(doc(db, "students", "s1"))),
      assertFails(getDoc(doc(db, "attendance", "2026-09-15", "records", "r1"))),
      assertFails(getDoc(doc(db, "dutyAssignments", "2026-09-15"))),
      assertFails(getDoc(doc(db, "statistics", "all"))),
      assertFails(getDoc(doc(db, "auditLogs", "seed"))),
    ]);
  });

  it("keeps a regular teacher read-only for administration data", async () => {
    const db = env.authenticatedContext("teacher").firestore();
    await assertSucceeds(getDoc(doc(db, "students", "s1")));
    await assertSucceeds(getDoc(doc(db, "dutyAssignments", "2026-09-15")));
    await assertFails(setDoc(doc(db, "students", "new"), { classId: "2-1", studentNo: 2, name: "New", active: true }));
    await assertFails(setDoc(doc(db, "periods", "p2"), { name: "P2", order: 2, active: true }));
    await assertFails(setDoc(doc(db, "classes", "2-2"), { grade: 2, classNo: 2, active: true }));
    await assertFails(updateDoc(doc(db, "auditLogs", "seed"), { action: "ALTERED" }));
  });

  it("allows only the assigned teacher to write that date's attendance", async () => {
    const record = { date: "2026-09-15", studentId: "s1", classId: "2-1", periodId: "p1", status: "present", note: "", markedBy: "dutyTeacher", markedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(env.authenticatedContext("dutyTeacher").firestore(), "attendance", "2026-09-15", "records", "r1"), record));
    await assertFails(setDoc(doc(env.authenticatedContext("teacher").firestore(), "attendance", "2026-09-15", "records", "r2"), { ...record, markedBy: "teacher" }));
    await assertFails(setDoc(doc(env.authenticatedContext("dutyTeacher").firestore(), "attendance", "2026-09-15", "records", "r3"), { ...record, periodId: "p2" }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext("teacher").firestore(), "attendance", "2026-09-15", "records", "r4"), { ...record, periodId: "p2", markedBy: "teacher" }));
  });

  it("enforces the duty edit window and denies legacy assignments", async () => {
    const record = { date: "2026-09-16", studentId: "s1", classId: "2-1", periodId: "p1", status: "present", note: "", markedBy: "dutyTeacher", markedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "dutyAssignments", "2026-09-16"), { date: "2026-09-16", teacherUid: "dutyTeacher", editableFrom: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2101-01-01T00:00:00Z")) });
      await setDoc(doc(db, "dutyAssignments", "2026-09-17"), { date: "2026-09-17", teacherUid: "dutyTeacher" });
    });
    const teacherDb = env.authenticatedContext("dutyTeacher").firestore();
    await assertFails(setDoc(doc(teacherDb, "attendance", "2026-09-16", "records", "before"), record));
    await assertFails(setDoc(doc(teacherDb, "attendance", "2026-09-17", "records", "legacy"), { ...record, date: "2026-09-17" }));
    await assertSucceeds(setDoc(doc(env.authenticatedContext("admin").firestore(), "attendance", "2026-09-17", "records", "admin"), { ...record, date: "2026-09-17", markedBy: "admin" }));
  });

  it("allows a grade admin to manage master data and statistics", async () => {
    const db = env.authenticatedContext("admin").firestore();
    await assertSucceeds(setDoc(doc(db, "students", "new"), { classId: "2-1", studentNo: 2, name: "New", active: true }));
    await assertSucceeds(setDoc(doc(db, "periods", "p2"), { name: "P2", order: 2, active: true }));
    await assertSucceeds(setDoc(doc(db, "dutyAssignments", "2026-09-16"), { date: "2026-09-16", teacherUid: "teacher", teacherName: "Teacher" }));
    await assertSucceeds(getDoc(doc(db, "statistics", "all")));
  });

  it("honors the homeroom statistics policy", async () => {
    const homeroom = env.authenticatedContext("homeroom").firestore();
    await assertFails(getDoc(doc(homeroom, "statistics", "all")));
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "access"), { statsVisibility: "grade_admin_and_homeroom", homeroomStatsScope: "own_class" }));
    await assertFails(getDoc(doc(homeroom, "statistics", "all")));
  });

  it("allows system owner user administration while protecting audit immutability", async () => {
    const db = env.authenticatedContext("owner").firestore();
    await assertSucceeds(updateDoc(doc(db, "users", "teacher"), { active: false }));
    await assertFails(updateDoc(doc(db, "auditLogs", "seed"), { action: "ALTERED" }));
    await assertSucceeds(setDoc(doc(db, "auditLogs", "new"), { actorUid: "owner", actorName: "owner", action: "X", targetType: "x", targetId: "x", timestamp: serverTimestamp() }));
  });

  it("reserves grade-admin role changes for the system owner", async () => {
    const admin = env.authenticatedContext("admin").firestore();
    await assertFails(updateDoc(doc(admin, "users", "teacher"), { roles: ["teacher", "grade_admin"] }));
    await assertSucceeds(updateDoc(doc(env.authenticatedContext("owner").firestore(), "users", "teacher"), { roles: ["teacher", "grade_admin"] }));
  });

  it("limits pending user requests to the authenticated UID and owner review", async () => {
    const own = env.authenticatedContext("pending").firestore();
    const pending = { uid: "pending", email: "pending@example.com", displayName: "Pending", provider: "google", createdAt: serverTimestamp(), lastLoginAt: serverTimestamp() };
    await assertSucceeds(setDoc(doc(own, "pendingUsers", "pending"), pending));
    await assertSucceeds(setDoc(doc(own, "pendingUsers", "pending"), { lastLoginAt: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(doc(own, "pendingUsers", "other"), { ...pending, uid: "other" }));
    await assertFails(setDoc(doc(own, "pendingUsers", "pending"), { ...pending, roles: ["system_owner"] }));
    await assertFails(getDocs(collection(env.authenticatedContext("teacher").firestore(), "pendingUsers")));
    await assertSucceeds(getDocs(collection(env.authenticatedContext("owner").firestore(), "pendingUsers")));
  });
});
