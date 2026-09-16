import { describe, expect, it } from "vitest";
import { hasGradeAssignment, isGradeAdminForGrade } from "../domain/scope";
import { buildStaffAssignmentDocument } from "../services/staffAssignments";
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
});
