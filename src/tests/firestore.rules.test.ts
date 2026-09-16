import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";

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
    await assertFails(getDoc(doc(db, "students", "s1")));
    await assertFails(getDoc(doc(db, "dutyAssignments", "2026-09-15")));
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
    await assertFails(setDoc(doc(db, "students", "new"), { classId: "2-1", studentNo: 2, name: "New", active: true }));
    await assertFails(setDoc(doc(db, "periods", "p2"), { name: "P2", order: 2, active: true }));
    await assertFails(setDoc(doc(db, "dutyAssignments", "2026-09-16"), { date: "2026-09-16", teacherUid: "teacher", teacherName: "Teacher" }));
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

  it("enforces scoped class, student, period, and assignment access", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "scopedOwner"), { ...user("scopedOwner", ["system_owner"]), globalRoles: ["teacher", "system_owner"] }),
        setDoc(doc(db, "users", "teacherA"), { ...user("teacherA", ["teacher"]), globalRoles: ["teacher"] }),
        setDoc(doc(db, "users", "adminA"), { ...user("adminA", ["teacher"]), globalRoles: ["teacher"] }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_teacherA"), { academicYearId: "2026", gradeId: "2026-1", uid: "teacherA", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_adminA"), { academicYearId: "2026", gradeId: "2026-1", uid: "adminA", role: "grade_admin", active: true }),
        setDoc(doc(db, "classes", "scoped-c1"), { academicYearId: "2026", gradeId: "2026-1", classNumber: 1, displayName: "1-1", active: true }),
        setDoc(doc(db, "classes", "scoped-c2"), { academicYearId: "2026", gradeId: "2026-2", classNumber: 1, displayName: "2-1", active: true }),
        setDoc(doc(db, "students", "scoped-s1"), { academicYearId: "2026", gradeId: "2026-1", classId: "scoped-c1", studentNo: 1, name: "A", active: true }),
        setDoc(doc(db, "periods", "scoped-p1"), { academicYearId: "2026", gradeId: "2026-1", name: "P1", order: 1, active: true }),
      ]);
    });
    const teacherA = env.authenticatedContext("teacherA").firestore();
    const adminA = env.authenticatedContext("adminA").firestore();
    await assertSucceeds(getDoc(doc(teacherA, "classes", "scoped-c1")));
    await assertFails(getDoc(doc(teacherA, "classes", "scoped-c2")));
    await assertFails(setDoc(doc(teacherA, "periods", "blocked"), { academicYearId: "2026", gradeId: "2026-1", name: "P2", order: 2, active: true }));
    await assertSucceeds(setDoc(doc(adminA, "periods", "scoped-p2"), { academicYearId: "2026", gradeId: "2026-1", name: "P2", order: 2, active: true }));
    await assertFails(setDoc(doc(adminA, "students", "bad"), { academicYearId: "2026", gradeId: "2026-1", classId: "scoped-c2", studentNo: 2, name: "Bad", active: true }));
    await assertSucceeds(getDocs(query(collection(teacherA, "classes"), where("academicYearId", "==", "2026"), where("gradeId", "==", "2026-1"))));
  });

  it("enforces Duty V2 parent, child, batch, query, and exception scope rules", async () => {
    const parentId = "2026-1_2026-09-16";
    const parent = { academicYearId: "2026", gradeId: "2026-1", date: "2026-09-16", schemaVersion: 2, updatedAt: Timestamp.now() };
    const child = { academicYearId: "2026", gradeId: "2026-1", date: "2026-09-16", periodId: "duty-p1", teacherUid: "teacherA", teacherName: "Teacher A", editableFrom: Timestamp.fromDate(new Date("2026-09-16T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2026-09-17T00:00:00Z")) };
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "teacherA"), user("teacherA", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "teacherB"), user("teacherB", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "adminA"), user("adminA", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "adminB"), user("adminB", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "inactiveStaff"), user("inactiveStaff", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "grades", "2026-1"), { academicYearId: "2026", gradeNumber: 1, displayName: "1", active: true }),
        setDoc(doc(db, "grades", "2026-2"), { academicYearId: "2026", gradeNumber: 2, displayName: "2", active: true }),
        setDoc(doc(db, "grades", "2027-1"), { academicYearId: "2027", gradeNumber: 1, displayName: "1", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_teacherA"), { academicYearId: "2026", gradeId: "2026-1", uid: "teacherA", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_adminA"), { academicYearId: "2026", gradeId: "2026-1", uid: "adminA", role: "grade_admin", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-2_adminB"), { academicYearId: "2026", gradeId: "2026-2", uid: "adminB", role: "grade_admin", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-2_teacherB"), { academicYearId: "2026", gradeId: "2026-2", uid: "teacherB", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_inactiveStaff"), { academicYearId: "2026", gradeId: "2026-1", uid: "inactiveStaff", role: "teacher", active: false }),
        setDoc(doc(db, "periods", "duty-p1"), { academicYearId: "2026", gradeId: "2026-1", name: "P1", order: 1, active: true }),
        setDoc(doc(db, "periods", "duty-p2"), { academicYearId: "2026", gradeId: "2026-2", name: "P2", order: 1, active: true }),
        setDoc(doc(db, "periods", "duty-inactive"), { academicYearId: "2026", gradeId: "2026-1", name: "P3", order: 3, active: false }),
        setDoc(doc(db, "dutyAssignments", parentId), parent),
        setDoc(doc(db, "dutyAssignments", parentId, "periods", "duty-p1"), child),
        setDoc(doc(db, "selfStudyExceptions", "legacy-exception"), { date: "2026-09-22", reasonType: "manual", reason: "Legacy", enabled: true }),
      ]);
    });
    const teacherA = env.authenticatedContext("teacherA").firestore();
    const adminA = env.authenticatedContext("adminA").firestore();
    const adminB = env.authenticatedContext("adminB").firestore();
    const ownerDb = env.authenticatedContext("owner").firestore();
    await assertSucceeds(getDoc(doc(teacherA, "dutyAssignments", parentId)));
    await assertSucceeds(getDocs(collection(teacherA, "dutyAssignments", parentId, "periods")));
    await assertFails(getDoc(doc(adminB, "dutyAssignments", parentId)));
    await assertFails(getDocs(collection(adminB, "dutyAssignments", parentId, "periods")));
    await assertSucceeds(getDocs(query(collection(teacherA, "dutyAssignments"), where("academicYearId", "==", "2026"), where("gradeId", "==", "2026-1"), where("schemaVersion", "==", 2), where("date", ">=", "2026-09-01"), where("date", "<=", "2026-09-30"))));
    await assertFails(getDocs(query(collection(teacherA, "dutyAssignments"), where("academicYearId", "==", "2027"), where("gradeId", "==", "2027-1"), where("schemaVersion", "==", 2), where("date", ">=", "2027-09-01"), where("date", "<=", "2027-09-30"))));
    await assertFails(getDocs(collection(teacherA, "dutyAssignments")));
    await assertFails(setDoc(doc(teacherA, "dutyAssignments", "2026-1_2026-09-18"), { ...parent, date: "2026-09-18", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminB, "dutyAssignments", "2026-1_2026-09-18"), { ...parent, date: "2026-09-18", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", "wrong"), { ...parent, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", "2026-1_2026-09-18"), { ...parent, date: "2026-09-18", schemaVersion: 1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(adminA, "dutyAssignments", parentId), { gradeId: "2026-2" }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "wrong-id"), { ...child, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, gradeId: "2026-2", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "duty-p2"), { ...child, periodId: "duty-p2", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, teacherUid: "teacherB", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, teacherUid: "inactiveStaff", updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminA, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, editableUntil: child.editableFrom, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(teacherA, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(doc(adminB, "dutyAssignments", parentId, "periods", "duty-p1"), { ...child, updatedAt: serverTimestamp() }));
    const batch = writeBatch(adminA);
    const batchParentId = "2026-1_2026-09-18";
    const batchParent = { ...parent, date: "2026-09-18", updatedAt: serverTimestamp() };
    batch.set(doc(adminA, "dutyAssignments", batchParentId), batchParent);
    batch.set(doc(adminA, "dutyAssignments", batchParentId, "periods", "duty-p1"), { ...child, date: "2026-09-18", updatedAt: serverTimestamp() });
    batch.set(doc(adminA, "auditLogs", "duty-batch"), { actorUid: "adminA", actorName: "adminA", action: "DUTY_IMPORT_APPLIED", targetType: "duty", targetId: batchParentId, timestamp: serverTimestamp() });
    await assertSucceeds(batch.commit());
    const badBatch = writeBatch(adminA);
    badBatch.set(doc(adminA, "dutyAssignments", "2026-1_2026-09-19"), { ...parent, date: "2026-09-19", updatedAt: serverTimestamp() });
    badBatch.set(doc(adminA, "dutyAssignments", "2026-1_2026-09-19", "periods", "duty-p2"), { ...child, date: "2026-09-19", periodId: "duty-p2", updatedAt: serverTimestamp() });
    await assertFails(badBatch.commit());
    const schoolException = { academicYearId: "2026", scopeType: "school", gradeId: null, date: "2026-09-20", reasonType: "holiday", reason: "Holiday", active: true };
    const gradeException = { academicYearId: "2026", scopeType: "grade", gradeId: "2026-1", date: "2026-09-21", reasonType: "exam", reason: "Exam", active: true };
    await assertSucceeds(setDoc(doc(ownerDb, "selfStudyExceptions", "school"), schoolException));
    await assertSucceeds(setDoc(doc(adminA, "selfStudyExceptions", "grade"), gradeException));
    await assertFails(setDoc(doc(adminA, "selfStudyExceptions", "school-by-admin"), schoolException));
    await assertFails(setDoc(doc(adminB, "selfStudyExceptions", "other-grade"), gradeException));
    await assertFails(setDoc(doc(teacherA, "selfStudyExceptions", "teacher-write"), gradeException));
    await assertSucceeds(getDoc(doc(teacherA, "selfStudyExceptions", "school")));
    await assertSucceeds(getDoc(doc(teacherA, "selfStudyExceptions", "grade")));
    await assertSucceeds(getDocs(query(collection(teacherA, "selfStudyExceptions"), where("academicYearId", "==", "2026"), where("scopeType", "==", "school"), where("gradeId", "==", null))));
    await assertSucceeds(getDocs(query(collection(teacherA, "selfStudyExceptions"), where("academicYearId", "==", "2026"), where("scopeType", "==", "grade"), where("gradeId", "==", "2026-1"))));
    await assertFails(getDoc(doc(adminB, "selfStudyExceptions", "grade")));
    await assertFails(getDoc(doc(teacherA, "selfStudyExceptions", "legacy-exception")));
    await assertFails(getDoc(doc(adminA, "selfStudyExceptions", "legacy-exception")));
    await assertSucceeds(getDoc(doc(ownerDb, "selfStudyExceptions", "legacy-exception")));
    await assertFails(setDoc(doc(ownerDb, "selfStudyExceptions", "bad-school"), { ...schoolException, gradeId: "2026-1" }));
    await assertFails(setDoc(doc(ownerDb, "selfStudyExceptions", "bad-grade"), { ...gradeException, gradeId: null }));
    await assertFails(updateDoc(doc(adminA, "selfStudyExceptions", "grade"), { gradeId: "2026-2" }));
    await assertSucceeds(getDoc(doc(ownerDb, "dutyAssignments", "2026-09-15")));
  });
});
