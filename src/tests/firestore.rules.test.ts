import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, Timestamp, updateDoc, where, writeBatch } from "firebase/firestore";

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
    await assertFails(setDoc(doc(env.authenticatedContext("dutyTeacher").firestore(), "attendance", "2026-09-15", "records", "r1"), record));
    await assertFails(setDoc(doc(env.authenticatedContext("teacher").firestore(), "attendance", "2026-09-15", "records", "r2"), { ...record, markedBy: "teacher" }));
    await assertFails(setDoc(doc(env.authenticatedContext("dutyTeacher").firestore(), "attendance", "2026-09-15", "records", "r3"), { ...record, periodId: "p2" }));
    await assertFails(setDoc(doc(env.authenticatedContext("teacher").firestore(), "attendance", "2026-09-15", "records", "r4"), { ...record, periodId: "p2", markedBy: "teacher" }));
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
    await assertFails(setDoc(doc(env.authenticatedContext("admin").firestore(), "attendance", "2026-09-17", "records", "admin"), { ...record, date: "2026-09-17", markedBy: "admin" }));
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
    await assertSucceeds(setDoc(doc(db, "auditLogs", "new"), { actorUid: "owner", actorName: "owner", action: "X", targetType: "x", targetId: "x", before: null, after: null, source: "system", timestamp: serverTimestamp() }));
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
    batch.set(doc(adminA, "auditLogs", "duty-batch"), { actorUid: "adminA", actorName: "adminA", action: "DUTY_IMPORT_APPLIED", targetType: "duty", targetId: batchParentId, before: null, after: null, source: "excel", academicYearId: "2026", gradeId: "2026-1", timestamp: serverTimestamp() });
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

  it("enforces scoped attendance, history, and audit rules", async () => {
    const date = "2026-09-16";
    const gradeId = "2026-1";
    const dayId = `${gradeId}_${date}`;
    const record = (studentId: string, classId = "att-c1", markedBy = "teacherA") => ({ academicYearId: "2026", gradeId, date, classId, studentId, periodId: "att-p1", status: "present", note: "", markedBy, markedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    const recordId = (studentId: string, classId = "att-c1") => `${classId}__att-p1__${studentId}`;
    const audit = (actorUid: string, extras = {}) => ({ actorUid, actorName: actorUid, action: "ATTENDANCE_CREATED", targetType: "attendance", targetId: `${dayId}/${recordId("att-s1")}`, before: null, after: { status: "present" }, source: "manual", academicYearId: "2026", gradeId, classId: "att-c1", studentId: "att-s1", periodId: "att-p1", dutyDate: date, timestamp: serverTimestamp(), ...extras });
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "teacherA"), user("teacherA", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "adminA"), user("adminA", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "adminB"), user("adminB", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "homeA"), user("homeA", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "teacherWrong"), user("teacherWrong", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "grades", gradeId), { academicYearId: "2026", gradeNumber: 1, displayName: "1", active: true }),
        setDoc(doc(db, "grades", "2026-2"), { academicYearId: "2026", gradeNumber: 2, displayName: "2", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_teacherA"), { academicYearId: "2026", gradeId, uid: "teacherA", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_adminA"), { academicYearId: "2026", gradeId, uid: "adminA", role: "grade_admin", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_homeA"), { academicYearId: "2026", gradeId, uid: "homeA", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-1_teacherWrong"), { academicYearId: "2026", gradeId, uid: "teacherWrong", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_2026-2_adminB"), { academicYearId: "2026", gradeId: "2026-2", uid: "adminB", role: "grade_admin", active: true }),
        setDoc(doc(db, "classes", "att-c1"), { academicYearId: "2026", gradeId, classNumber: 1, displayName: "1-1", active: true, homeroomTeacherUid: "homeA" }),
        setDoc(doc(db, "classes", "att-c2"), { academicYearId: "2026", gradeId, classNumber: 2, displayName: "1-2", active: true }),
        setDoc(doc(db, "classes", "att-c3"), { academicYearId: "2026", gradeId: "2026-2", classNumber: 1, displayName: "2-1", active: true }),
        setDoc(doc(db, "students", "att-s1"), { academicYearId: "2026", gradeId, classId: "att-c1", studentNo: 1, name: "A", active: true }),
        setDoc(doc(db, "students", "att-s2"), { academicYearId: "2026", gradeId, classId: "att-c1", studentNo: 2, name: "B", active: true }),
        setDoc(doc(db, "students", "att-s3"), { academicYearId: "2026", gradeId, classId: "att-c2", studentNo: 1, name: "C", active: true }),
        setDoc(doc(db, "students", "att-s4"), { academicYearId: "2026", gradeId: "2026-2", classId: "att-c3", studentNo: 1, name: "D", active: true }),
        setDoc(doc(db, "periods", "att-p1"), { academicYearId: "2026", gradeId, name: "P1", order: 1, active: true }),
        setDoc(doc(db, "periods", "att-p2"), { academicYearId: "2026", gradeId: "2026-2", name: "P2", order: 1, active: true }),
        setDoc(doc(db, "dutyAssignments", dayId), { academicYearId: "2026", gradeId, date, schemaVersion: 2, updatedAt: Timestamp.now() }),
        setDoc(doc(db, "dutyAssignments", dayId, "periods", "att-p1"), { academicYearId: "2026", gradeId, date, periodId: "att-p1", teacherUid: "teacherA", teacherName: "Teacher A", editableFrom: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")), updatedAt: Timestamp.now() }),
        setDoc(doc(db, "dutyAssignments", "2026-1_2026-09-17"), { academicYearId: "2026", gradeId, date: "2026-09-17", schemaVersion: 2, updatedAt: Timestamp.now() }),
        setDoc(doc(db, "dutyAssignments", "2026-1_2026-09-17", "periods", "att-p1"), { academicYearId: "2026", gradeId, date: "2026-09-17", periodId: "att-p1", teacherUid: "teacherA", teacherName: "Teacher A", editableFrom: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2001-01-01T00:00:00Z")), updatedAt: Timestamp.now() }),
        setDoc(doc(db, "attendance", dayId, "records", recordId("att-s1")), record("att-s1")),
        setDoc(doc(db, "attendance", dayId, "records", recordId("att-s3", "att-c2")), record("att-s3", "att-c2")),
        setDoc(doc(db, "attendance", "legacy", "records", "legacy"), { date, classId: "att-c1", studentId: "att-s1", periodId: "att-p1", status: "present" }),
      ]);
    });
    const teacherA = env.authenticatedContext("teacherA").firestore();
    const adminA = env.authenticatedContext("adminA").firestore();
    const adminB = env.authenticatedContext("adminB").firestore();
    const homeA = env.authenticatedContext("homeA").firestore();
    const teacherWrong = env.authenticatedContext("teacherWrong").firestore();
    const ownerDb = env.authenticatedContext("owner").firestore();
    await assertSucceeds(getDoc(doc(ownerDb, "attendance", dayId, "records", recordId("att-s1"))));
    await assertSucceeds(getDoc(doc(adminA, "attendance", dayId, "records", recordId("att-s1"))));
    await assertFails(getDoc(doc(adminB, "attendance", dayId, "records", recordId("att-s1"))));
    await assertSucceeds(getDoc(doc(homeA, "attendance", dayId, "records", recordId("att-s1"))));
    await assertFails(getDoc(doc(homeA, "attendance", dayId, "records", recordId("att-s3", "att-c2"))));
    await assertSucceeds(getDoc(doc(teacherA, "attendance", dayId, "records", recordId("att-s1"))));
    await assertFails(getDoc(doc(teacherA, "attendance", "legacy", "records", "legacy")));
    await assertSucceeds(getDoc(doc(ownerDb, "attendance", "legacy", "records", "legacy")));
    await assertSucceeds(setDoc(doc(teacherA, "attendance", dayId, "records", recordId("att-s2")), record("att-s2")));
    await assertSucceeds(setDoc(doc(adminA, "attendance", dayId, "records", recordId("att-s2")), record("att-s2", "att-c1", "adminA")));
    await assertSucceeds(setDoc(doc(ownerDb, "attendance", dayId, "records", recordId("att-s2")), record("att-s2", "att-c1", "owner")));
    await assertFails(setDoc(doc(adminB, "attendance", dayId, "records", recordId("att-s2")), record("att-s2", "att-c1", "adminB")));
    await assertFails(setDoc(doc(homeA, "attendance", dayId, "records", recordId("att-s2")), record("att-s2", "att-c1", "homeA")));
    await assertFails(setDoc(doc(teacherWrong, "attendance", dayId, "records", recordId("att-s2")), record("att-s2", "att-c1", "teacherWrong")));
    await assertFails(setDoc(doc(teacherA, "attendance", "2026-1_2026-09-17", "records", recordId("att-s2")), { ...record("att-s2"), date: "2026-09-17" }));
    await assertFails(setDoc(doc(teacherA, "attendance", dayId, "records", recordId("att-s4", "att-c1")), { ...record("att-s4"), studentId: "att-s4" }));
    await assertFails(setDoc(doc(teacherA, "attendance", dayId, "records", "att-c1__att-p2__att-s1"), { ...record("att-s1"), periodId: "att-p2" }));
    await assertFails(updateDoc(doc(teacherA, "attendance", dayId, "records", recordId("att-s1")), { classId: "att-c2" }));
    await assertSucceeds(getDocs(query(collectionGroup(teacherA, "records"), where("academicYearId", "==", "2026"), where("gradeId", "==", gradeId), where("date", "==", date), where("periodId", "==", "att-p1"))));
    await assertFails(getDocs(collectionGroup(teacherA, "records")));
    await assertSucceeds(getDocs(query(collectionGroup(adminA, "records"), where("academicYearId", "==", "2026"), where("gradeId", "==", gradeId), where("date", ">=", date), where("date", "<=", date))));
    await assertFails(getDocs(collectionGroup(adminA, "records")));
    await assertSucceeds(getDocs(query(collectionGroup(homeA, "records"), where("academicYearId", "==", "2026"), where("gradeId", "==", gradeId), where("classId", "==", "att-c1"), where("date", ">=", date), where("date", "<=", date))));
    await assertFails(getDocs(query(collectionGroup(homeA, "records"), where("academicYearId", "==", "2026"), where("gradeId", "==", gradeId), where("date", ">=", date), where("date", "<=", date))));
    await assertSucceeds(setDoc(doc(teacherA, "auditLogs", "teacher-audit"), audit("teacherA")));
    await assertFails(setDoc(doc(teacherA, "auditLogs", "forged-audit"), audit("owner")));
    await assertSucceeds(getDocs(query(collection(adminA, "auditLogs"), where("academicYearId", "==", "2026"), where("gradeId", "==", gradeId))));
    await assertFails(getDocs(collection(adminA, "auditLogs")));
    await assertFails(getDocs(collection(teacherA, "auditLogs")));
    await assertSucceeds(getDocs(collection(ownerDb, "auditLogs")));
    await assertFails(updateDoc(doc(teacherA, "auditLogs", "teacher-audit"), { action: "ALTERED" }));
    await assertFails(deleteDoc(doc(teacherA, "auditLogs", "teacher-audit")));
    const batch = writeBatch(teacherA);
    batch.set(doc(teacherA, "attendance", dayId, "records", recordId("att-s1")), record("att-s1"));
    batch.set(doc(teacherA, "attendance", dayId, "records", recordId("att-s2")), record("att-s2"));
    batch.set(doc(teacherA, "auditLogs", "teacher-batch"), audit("teacherA", { action: "BULK_ATTENDANCE_MARKED", targetId: `${dayId}/att-c1/att-p1`, batchId: "batch", batchSize: 2 }));
    await assertSucceeds(batch.commit());
    const badBatch = writeBatch(teacherA);
    badBatch.set(doc(teacherA, "attendance", dayId, "records", recordId("att-s1")), record("att-s1"));
    badBatch.set(doc(teacherA, "attendance", dayId, "records", "att-c1__att-p2__att-s2"), { ...record("att-s2"), periodId: "att-p2" });
    await assertFails(badBatch.commit());
  });

  it("enforces emergency modes while preserving owner-only operations control", async () => {
    const operations = (emergencyMode: string, maintenance: Record<string, unknown> = { enabled: false, title: "", message: "", noticeFrom: null, startsAt: null, endsAt: null, bannerEnabled: true, popupEnabled: true }) => ({ emergencyMode, emergencyMessage: "notice", maintenance, updatedAt: Timestamp.now(), updatedBy: "owner" });
    const record = { academicYearId: "2026", gradeId: "mode-grade", date: "2026-09-16", classId: "mode-class", studentId: "mode-student", periodId: "mode-period", status: "present", note: "", markedBy: "mode-teacher", markedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    const recordPath = ["attendance", "mode-grade_2026-09-16", "records", "mode-class__mode-period__mode-student"] as const;
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "mode-teacher"), user("mode-teacher", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "staffAssignments", "2026_mode-grade_mode-teacher"), { academicYearId: "2026", gradeId: "mode-grade", uid: "mode-teacher", role: "teacher", active: true }),
        setDoc(doc(db, "classes", "mode-class"), { academicYearId: "2026", gradeId: "mode-grade", classNumber: 1, displayName: "1-1", active: true }),
        setDoc(doc(db, "students", "mode-student"), { academicYearId: "2026", gradeId: "mode-grade", classId: "mode-class", studentNo: 1, name: "Mode", active: true }),
        setDoc(doc(db, "periods", "mode-period"), { academicYearId: "2026", gradeId: "mode-grade", name: "P1", order: 1, active: true }),
        setDoc(doc(db, "dutyAssignments", "mode-grade_2026-09-16"), { academicYearId: "2026", gradeId: "mode-grade", date: "2026-09-16", schemaVersion: 2, updatedAt: Timestamp.now() }),
        setDoc(doc(db, "dutyAssignments", "mode-grade_2026-09-16", "periods", "mode-period"), { academicYearId: "2026", gradeId: "mode-grade", date: "2026-09-16", periodId: "mode-period", teacherUid: "mode-teacher", teacherName: "Mode", editableFrom: Timestamp.fromDate(new Date("2000-01-01T00:00:00Z")), editableUntil: Timestamp.fromDate(new Date("2100-01-01T00:00:00Z")), updatedAt: Timestamp.now() }),
      ]);
    });
    const ownerDb = env.authenticatedContext("owner").firestore();
    const teacherDb = env.authenticatedContext("mode-teacher").firestore();
    await assertSucceeds(getDoc(doc(teacherDb, "settings", "operations")));
    await assertFails(setDoc(doc(teacherDb, "settings", "operations"), { ...operations("LOCKDOWN"), updatedBy: "mode-teacher", updatedAt: serverTimestamp() }));

    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("READ_ONLY")));
    await assertFails(setDoc(doc(teacherDb, ...recordPath), record));
    await assertFails(setDoc(doc(ownerDb, "periods", "owner-read-only"), { academicYearId: "2026", gradeId: "mode-grade", name: "P2", order: 2, active: true }));

    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("ESSENTIAL_ONLY")));
    await assertSucceeds(setDoc(doc(teacherDb, ...recordPath), record));
    await assertSucceeds(setDoc(doc(teacherDb, "auditLogs", "essential-audit"), { actorUid: "mode-teacher", actorName: "Mode", action: "ATTENDANCE_CREATED", targetType: "attendance", targetId: "mode", before: null, after: {}, source: "manual", academicYearId: "2026", gradeId: "mode-grade", classId: "mode-class", studentId: "mode-student", periodId: "mode-period", dutyDate: "2026-09-16", timestamp: serverTimestamp() }));
    await assertFails(setDoc(doc(teacherDb, "periods", "teacher-essential"), { academicYearId: "2026", gradeId: "mode-grade", name: "P2", order: 2, active: true }));

    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("MAINTENANCE")));
    await assertFails(getDoc(doc(teacherDb, ...recordPath)));
    await assertSucceeds(setDoc(doc(ownerDb, "periods", "owner-maintenance"), { academicYearId: "2026", gradeId: "mode-grade", name: "P2", order: 2, active: true }));

    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("LOCKDOWN")));
    await assertFails(getDoc(doc(teacherDb, ...recordPath)));
    await assertSucceeds(getDoc(doc(ownerDb, ...recordPath)));
    await assertFails(setDoc(doc(ownerDb, "periods", "owner-lockdown"), { academicYearId: "2026", gradeId: "mode-grade", name: "P3", order: 3, active: true }));

    const now = Date.now();
    const activeWindow = { enabled: true, title: "Maintenance", message: "Active", noticeFrom: Timestamp.fromMillis(now - 120_000), startsAt: Timestamp.fromMillis(now - 60_000), endsAt: Timestamp.fromMillis(now + 60_000), bannerEnabled: true, popupEnabled: true };
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("NORMAL", activeWindow)));
    await assertFails(getDoc(doc(teacherDb, ...recordPath)));
    await assertSucceeds(setDoc(doc(ownerDb, "periods", "owner-scheduled-maintenance"), { academicYearId: "2026", gradeId: "mode-grade", name: "P4", order: 4, active: true }));
    const expiredWindow = { ...activeWindow, startsAt: Timestamp.fromMillis(now - 180_000), endsAt: Timestamp.fromMillis(now - 120_000) };
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "settings", "operations"), operations("NORMAL", expiredWindow)));
    await assertSucceeds(getDoc(doc(teacherDb, ...recordPath)));
    await assertSucceeds(setDoc(doc(ownerDb, "settings", "operations"), { ...operations("NORMAL"), updatedBy: "owner", updatedAt: serverTimestamp() }));
  });

  it("enforces self-study operation scope, supervision, and homeroom permissions", async () => {
    const scope = { academicYearId: "2026", gradeId: "operation-grade" };
    const group = { ...scope, displayName: "Regular", type: "REGULAR", active: true, sortOrder: 1, updatedAt: serverTimestamp() };
    const period = { ...scope, name: "P1", order: 1, startTime: "18:00", endTime: "18:50", active: true };
    const membership = { ...scope, studentId: "operation-student", classId: "operation-class", selfStudyGroupId: "operation-group", active: true, updatedAt: serverTimestamp() };
    const supervision = { ...scope, date: "2026-09-16", periodId: "operation-period", selfStudyGroupId: "operation-group", teacherUid: "operation-teacher", teacherDisplayName: "Teacher", active: true, updatedAt: serverTimestamp() };
    const permission = { ...scope, classId: "operation-class", studentId: "operation-student", date: "2026-09-16", periodIds: ["operation-period"], reasonCode: "MEDICAL", reasonText: "Clinic", active: true, approvedByUid: "operation-home", approvedAt: serverTimestamp(), updatedAt: serverTimestamp() };
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "operation-teacher"), user("operation-teacher", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "operation-admin"), user("operation-admin", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "users", "operation-home"), user("operation-home", ["teacher"], { globalRoles: ["teacher"] })),
        setDoc(doc(db, "grades", "operation-grade"), { academicYearId: "2026", gradeNumber: 1, displayName: "1", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_operation-grade_operation-teacher"), { ...scope, uid: "operation-teacher", role: "teacher", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_operation-grade_operation-admin"), { ...scope, uid: "operation-admin", role: "grade_admin", active: true }),
        setDoc(doc(db, "staffAssignments", "2026_operation-grade_operation-home"), { ...scope, uid: "operation-home", role: "teacher", active: true }),
        setDoc(doc(db, "classes", "operation-class"), { ...scope, classNumber: 1, displayName: "1-1", active: true, homeroomTeacherUid: "operation-home" }),
        setDoc(doc(db, "students", "operation-student"), { ...scope, classId: "operation-class", studentNo: 1, name: "Student", active: true }),
        setDoc(doc(db, "periods", "operation-period"), period),
        setDoc(doc(db, "selfStudyGroups", "operation-group"), group),
      ]);
    });
    const ownerDb = env.authenticatedContext("owner").firestore();
    const teacherDb = env.authenticatedContext("operation-teacher").firestore();
    const adminDb = env.authenticatedContext("operation-admin").firestore();
    const homeDb = env.authenticatedContext("operation-home").firestore();
    await assertSucceeds(setDoc(doc(ownerDb, "selfStudyGroupPeriods", "operation-group_operation-period"), { ...scope, groupId: "operation-group", periodId: "operation-period", active: true, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(adminDb, "selfStudyMemberships", "2026_operation-grade_operation-student"), membership));
    await assertFails(setDoc(doc(teacherDb, "selfStudyMemberships", "2026_operation-grade_operation-student"), membership));
    await assertSucceeds(setDoc(doc(adminDb, "supervisionAssignments", "operation-grade_2026-09-16_operation-period_operation-group_operation-teacher"), supervision));
    await assertSucceeds(getDocs(query(collection(teacherDb, "supervisionAssignments"), where("academicYearId", "==", "2026"), where("gradeId", "==", "operation-grade"), where("date", "==", "2026-09-16"), where("periodId", "==", "operation-period"), where("teacherUid", "==", "operation-teacher"))));
    await assertFails(getDocs(query(collection(teacherDb, "supervisionAssignments"), where("academicYearId", "==", "2026"), where("gradeId", "==", "operation-grade"))));
    await assertSucceeds(setDoc(doc(homeDb, "selfStudyPermissions", "2026_operation-grade_2026-09-16_operation-student"), permission));
    await assertFails(setDoc(doc(teacherDb, "selfStudyPermissions", "2026_operation-grade_2026-09-16_operation-student"), { ...permission, approvedByUid: "operation-teacher" }));
    await assertFails(setDoc(doc(adminDb, "selfStudyPermissions", "2026_operation-grade_2026-09-16_operation-student"), { ...permission, approvedByUid: "operation-admin" }));
    await assertSucceeds(getDoc(doc(homeDb, "selfStudyMemberships", "2026_operation-grade_operation-student")));
    await assertFails(getDocs(collection(teacherDb, "users")));
    await assertFails(setDoc(doc(ownerDb, "selfStudyGroups", "wrong-scope"), { ...group, gradeId: "missing-grade" }));
  });

  it("validates optional StaffAssignment displayName projections without changing authority", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "grades", "projection-grade"), { academicYearId: "2026", gradeNumber: 1, displayName: "1", active: true });
      await setDoc(doc(db, "users", "projection-user"), user("projection-user", ["teacher"], { globalRoles: ["teacher"] }));
      await setDoc(doc(db, "staffAssignments", "2026_projection-grade_legacy"), { academicYearId: "2026", gradeId: "projection-grade", uid: "legacy", role: "teacher", active: true });
    });
    const ownerDb = env.authenticatedContext("owner").firestore();
    const base = { academicYearId: "2026", gradeId: "projection-grade", uid: "projection-user", role: "teacher", active: true };
    const ref = doc(ownerDb, "staffAssignments", "2026_projection-grade_projection-user");
    await assertSucceeds(setDoc(ref, base));
    await assertSucceeds(updateDoc(ref, { displayName: "김민수" }));
    await assertFails(setDoc(doc(ownerDb, "staffAssignments", "2026_projection-grade_empty"), { ...base, uid: "empty", displayName: "" }));
    await assertFails(setDoc(doc(ownerDb, "staffAssignments", "2026_projection-grade_number"), { ...base, uid: "number", displayName: 1 }));
    await assertFails(setDoc(doc(ownerDb, "staffAssignments", "2026_projection-grade_long"), { ...base, uid: "long", displayName: "a".repeat(121) }));
    await assertSucceeds(updateDoc(doc(ownerDb, "staffAssignments", "2026_projection-grade_legacy"), { displayName: "Legacy" }));
    await assertFails(getDocs(collection(env.authenticatedContext("teacher").firestore(), "users")));
  });
});
