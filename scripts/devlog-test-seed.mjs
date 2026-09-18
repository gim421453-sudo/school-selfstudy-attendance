import { readFileSync } from "node:fs";
import { doc, setDoc } from "firebase/firestore";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const projectId = "school-selfstudy-attendance-devlog";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const email = process.env.DEVLOG_SCREENSHOT_TEST_EMAIL || "devlog-admin@example.test";
const password = process.env.DEVLOG_SCREENSHOT_TEST_PASSWORD;
const isLocal = (value) => /^(127\.0\.0\.1|localhost|\[?::1\]?):\d+$/.test(value);

if (process.env.DEVLOG_SCREENSHOT_TEST_MODE !== "1" || !password || !isLocal(authHost) || !isLocal(firestoreHost)) {
  throw new Error("Seed requires DEVLOG_SCREENSHOT_TEST_MODE=1, a test password, and local Auth/Firestore Emulator hosts.");
}

async function authRequest(path, body) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/${path}?key=devlog-emulator-key`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok && !(path === "accounts:signUp" && text.includes("EMAIL_EXISTS"))) throw new Error(`Auth Emulator request failed: ${response.status}`);
  return text ? JSON.parse(text) : {};
}

await authRequest("accounts:signUp", { email, password, returnSecureToken: true });
const authUser = await authRequest("accounts:signInWithPassword", { email, password, returnSecureToken: true });
const uid = authUser.localId;
const env = await initializeTestEnvironment({ projectId, firestore: { rules: readFileSync("firestore.rules", "utf8") } });
try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const now = new Date();
    const scope = { academicYearId: "2026-test", gradeId: "2026-test-2" };
    const docs = [
      ["users", uid, { uid, email, displayName: "테스트 관리자", globalRoles: ["system_owner"], roles: ["system_owner", "teacher"], active: true }],
      ["academicYears", "2026-test", { displayName: "2026 테스트 학년도", active: true, isCurrent: true }],
      ["grades", "2026-test-2", { ...scope, gradeNumber: 2, displayName: "테스트 2학년", active: true }],
      ["classes", "2026-test-2-class-1", { ...scope, classNumber: 1, displayName: "2학년 1반", active: true }],
      ["students", "devlog-student-01", { ...scope, classId: "2026-test-2-class-1", studentNo: 1, name: "테스트 학생 01", active: true }],
      ["students", "devlog-student-02", { ...scope, classId: "2026-test-2-class-1", studentNo: 2, name: "테스트 학생 02", active: true }],
      ["periods", "2026-test-2-period-1", { ...scope, name: "테스트 1교시", order: 1, startTime: "18:00", endTime: "18:50", periodType: "SELF_STUDY", operatingDays: [1, 2, 3, 4, 5], active: true }],
      ["selfStudyGroups", "2026-test-2-group-a", { ...scope, displayName: "테스트 자습그룹 A", type: "REGULAR", active: true, sortOrder: 1 }],
      ["selfStudyGroupPeriods", "2026-test-2-group-a-2026-test-2-period-1", { ...scope, groupId: "2026-test-2-group-a", periodId: "2026-test-2-period-1", active: true, updatedAt: now }],
      ["selfStudyMemberships", "2026-test-2-devlog-student-01", { ...scope, studentId: "devlog-student-01", classId: "2026-test-2-class-1", selfStudyGroupId: "2026-test-2-group-a", active: true, updatedAt: now }],
      ["selfStudyMemberships", "2026-test-2-devlog-student-02", { ...scope, studentId: "devlog-student-02", classId: "2026-test-2-class-1", selfStudyGroupId: "2026-test-2-group-a", active: true, updatedAt: now }],
      ["settings", "access", { statsVisibility: "grade_admin_only", homeroomStatsScope: "own_class" }],
      ["settings", "operations", { emergencyMode: "NORMAL", emergencyMessage: "", maintenance: { enabled: false, title: "", message: "", noticeFrom: null, startsAt: null, endsAt: null, bannerEnabled: false, popupEnabled: false }, updatedBy: uid, updatedAt: now }],
    ];
    await Promise.all(docs.map(([collection, id, data]) => setDoc(doc(db, collection, id), data)));
  });
} finally {
  await env.cleanup();
}
console.log(`Seeded local test account ${email} and virtual Firestore data in ${projectId}.`);
