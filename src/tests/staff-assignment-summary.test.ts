import { describe, expect, it } from "vitest";
import { summarizeStaffAssignmentsByGrade } from "../domain/staffAssignmentSummary";

describe("staff assignment dashboard summary", () => {
  it("groups active assignments by the selected academic year and grade", () => {
    const result = summarizeStaffAssignmentsByGrade([
      { id: "g1", academicYearId: "2026", gradeNumber: 1, displayName: "1학년", active: true },
      { id: "g2", academicYearId: "2026", gradeNumber: 2, displayName: "2학년", active: true },
      { id: "old", academicYearId: "2027", gradeNumber: 1, displayName: "다음", active: true },
    ], [
      { id: "a1", academicYearId: "2026", gradeId: "g1", uid: "u1", role: "teacher", active: true, displayName: "교사" },
      { id: "a2", academicYearId: "2026", gradeId: "g1", uid: "u2", role: "grade_admin", active: true, displayName: "학년부" },
      { id: "a3", academicYearId: "2026", gradeId: "g2", uid: "u3", role: "teacher", active: false },
      { id: "a4", academicYearId: "2027", gradeId: "old", uid: "u4", role: "grade_admin", active: true },
    ], "2026");
    expect(result).toMatchObject([{ gradeId: "g1", assignedCount: 2, gradeAdminCount: 1, teacherCount: 1 }, { gradeId: "g2", assignedCount: 0, gradeAdminCount: 0, teacherCount: 0 }]);
  });
});
