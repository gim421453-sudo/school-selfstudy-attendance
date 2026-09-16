import { describe, expect, it } from "vitest";
import { makeGradeId, makeStaffAssignmentId } from "../domain/ids";
import { hasGradeAssignment, isGradeAdminForGrade, isScopeSelectable, isTeacherForGrade } from "../domain/scope";
import type { AcademicYear, AppUser, StaffAssignment } from "../types/domain";

const user: AppUser = { uid: "teacher", email: "teacher@example.com", displayName: "Teacher", active: true, globalRoles: ["teacher"], roles: ["teacher"] };
const assignments: StaffAssignment[] = [
  { id: makeStaffAssignmentId("2026", "2026-1", "teacher"), academicYearId: "2026", gradeId: "2026-1", uid: "teacher", role: "teacher", active: true },
  { id: makeStaffAssignmentId("2026", "2026-2", "teacher"), academicYearId: "2026", gradeId: "2026-2", uid: "teacher", role: "grade_admin", active: true },
  { id: makeStaffAssignmentId("2027", "2027-1", "teacher"), academicYearId: "2027", gradeId: "2027-1", uid: "teacher", role: "teacher", active: false },
];

describe("academic and staff service contracts", () => {
  it("keeps academic years and deterministic grade IDs separate", () => {
    const years: AcademicYear[] = [{ id: "2026", displayName: "2026학년도", active: true, isCurrent: true }, { id: "2027", displayName: "2027학년도", active: true, isCurrent: false }];
    expect(years.filter((year) => year.isCurrent)).toHaveLength(1);
    expect(makeGradeId("2026", 2)).toBe("2026-2");
    expect(makeGradeId("2027", 2)).toBe("2027-2");
  });

  it("allows one teacher to hold several annual grade assignments", () => {
    expect(hasGradeAssignment(assignments, "teacher", "2026", "2026-1")).toBe(true);
    expect(hasGradeAssignment(assignments, "teacher", "2026", "2026-2")).toBe(true);
    expect(isTeacherForGrade(assignments, "teacher", "2026", "2026-1")).toBe(true);
  });

  it("keeps grade administrator authority scoped to one grade and year", () => {
    expect(isGradeAdminForGrade(assignments, "teacher", "2026", "2026-2")).toBe(true);
    expect(isGradeAdminForGrade(assignments, "teacher", "2026", "2026-1")).toBe(false);
    expect(isGradeAdminForGrade(assignments, "teacher", "2027", "2027-1")).toBe(false);
    expect(isScopeSelectable(user, assignments, { academicYearId: "2027", gradeId: "2027-1" })).toBe(false);
  });

  it("does not derive scoped grade admin from the account's global roles", () => {
    const legacyGradeAdmin: AppUser = { ...user, globalRoles: ["teacher"], roles: ["teacher", "grade_admin"] };
    expect(isGradeAdminForGrade(assignments, legacyGradeAdmin.uid, "2026", "2026-1")).toBe(false);
    expect(isGradeAdminForGrade(assignments, legacyGradeAdmin.uid, "2026", "2026-2")).toBe(true);
  });
});
