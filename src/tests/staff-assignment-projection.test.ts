import { describe, expect, it } from "vitest";
import { hasGradeAssignment, isGradeAdminForGrade } from "../domain/scope";
import { buildStaffAssignmentDocument, normalizeStaffAssignmentDocument, summarizeStaffAssignmentConsistency } from "../services/staffAssignments";
import type { StaffAssignment } from "../types/domain";

describe("StaffAssignment displayName projection", () => {
  const input = { academicYearId: "2026", gradeId: "2026-1", uid: "teacher", displayName: "김민수" };
  it("stores the snapshot while leaving role authority independent", () => {
    const teacher = buildStaffAssignmentDocument(input, "teacher", true);
    const admin = buildStaffAssignmentDocument(input, "grade_admin", true);
    expect(teacher.displayName).toBe("김민수");
    expect(admin.displayName).toBe("김민수");
    expect(isGradeAdminForGrade([{ id: "a", ...admin }], "teacher", "2026", "2026-1")).toBe(true);
  });
  it("keeps multiple grades and years independent", () => {
    const values = [buildStaffAssignmentDocument(input, "teacher", true), buildStaffAssignmentDocument({ ...input, gradeId: "2026-2", displayName: "김민수" }, "grade_admin", true), buildStaffAssignmentDocument({ ...input, academicYearId: "2027", gradeId: "2027-1", displayName: "김민수" }, "teacher", false)].map((item, index) => ({ id: String(index), ...item }));
    expect(hasGradeAssignment(values, "teacher", "2026", "2026-1")).toBe(true);
    expect(isGradeAdminForGrade(values, "teacher", "2026", "2026-2")).toBe(true);
    expect(hasGradeAssignment(values, "teacher", "2027", "2027-1")).toBe(false);
  });
  it("accepts legacy assignments without a projection", () => {
    const legacy: StaffAssignment = { id: "legacy", academicYearId: "2026", gradeId: "2026-1", uid: "teacher", role: "teacher", active: true };
    expect(legacy.displayName).toBeUndefined();
    expect(hasGradeAssignment([legacy], "teacher", "2026", "2026-1")).toBe(true);
  });
  it("normalizes canonical teacher and grade administrator documents without requiring optional fields", () => {
    const teacher = normalizeStaffAssignmentDocument("teacher-doc", { academicYearId: "2026", gradeId: "2026-1", uid: "teacher", role: "teacher", active: true });
    const admin = normalizeStaffAssignmentDocument("admin-doc", { academicYearId: "2026", gradeId: "2026-2", uid: "teacher", role: "grade_admin", active: true, updatedAt: { seconds: 1 } });
    expect(teacher.assignment?.role).toBe("teacher");
    expect(admin.assignment?.role).toBe("grade_admin");
    expect(teacher.rejectedReason).toBeNull();
    expect(admin.rejectedReason).toBeNull();
  });
  it("rejects malformed assignments with an explicit diagnostic reason", () => {
    const malformed = normalizeStaffAssignmentDocument("bad", { academicYearId: "2026", gradeId: "2026-2", uid: "teacher", role: "teacher" });
    expect(malformed.assignment).toBeNull();
    expect(malformed.rejectedReason).toBe("invalid_active");
  });
  it("keeps the selected user UID in the canonical assignment document and reports orphan data", () => {
    const selectedUser: import("../types/domain").AppUser = { uid: "auth-user-a", email: "a@example.com", displayName: "A", active: true, globalRoles: ["teacher"], roles: ["teacher"] };
    const document = buildStaffAssignmentDocument({ academicYearId: "2026", gradeId: "2026-2", uid: selectedUser.uid }, "teacher", true);
    const linked = { id: "2026_2026-2_auth-user-a", ...document };
    const orphan = { id: "2026_2026-2_missing", ...buildStaffAssignmentDocument({ academicYearId: "2026", gradeId: "2026-2", uid: "missing" }, "grade_admin", true) };
    expect(linked.uid).toBe(selectedUser.uid);
    expect(summarizeStaffAssignmentConsistency([selectedUser], [linked, orphan])).toMatchObject({ linkedAssignmentCount: 1, orphanAssignmentCount: 1, nonCanonicalDocumentIdCount: 0 });
  });
});
