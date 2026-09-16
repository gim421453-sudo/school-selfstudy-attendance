import { describe, expect, it } from "vitest";
import {
  canAssignHomeroomTeacher,
  canReadClass,
  canViewClassStatistics,
  chooseInitialScope,
  chooseInitialSchoolScope,
  exceptionAppliesToScope,
  hasGradeAssignment,
  isGradeAdminForGrade,
  isScopeSelectable,
  isValidSchoolScope,
  isTeacherForGrade,
} from "../domain/scope";
import { visibleNavigation } from "../navigation";
import type { AcademicYear, AppUser, ClassRoom, Grade, StaffAssignment } from "../types/domain";

const owner: AppUser = { uid: "owner", email: "owner@example.com", displayName: "Owner", active: true, roles: ["teacher", "system_owner"], globalRoles: ["teacher", "system_owner"] };
const teacher: AppUser = { uid: "teacher", email: "teacher@example.com", displayName: "Teacher", active: true, roles: ["teacher"], globalRoles: ["teacher"] };
const administrator: AppUser = { uid: "admin", email: "admin@example.com", displayName: "Admin", active: true, roles: ["teacher"], globalRoles: ["teacher"] };
const assignments: StaffAssignment[] = [
  { id: "2026_2026-1_teacher", academicYearId: "2026", gradeId: "2026-1", uid: "teacher", role: "teacher", active: true },
  { id: "2026_2026-2_teacher", academicYearId: "2026", gradeId: "2026-2", uid: "teacher", role: "teacher", active: true },
  { id: "2026_2026-2_admin", academicYearId: "2026", gradeId: "2026-2", uid: "admin", role: "grade_admin", active: true },
  { id: "2027_2027-1_teacher", academicYearId: "2027", gradeId: "2027-1", uid: "teacher", role: "teacher", active: true },
];
const classroom: ClassRoom = { id: "2026-2-3", academicYearId: "2026", gradeId: "2026-2", classNumber: 3, displayName: "2-3", homeroomTeacherUid: "teacher", homeroomTeacherName: "Teacher", active: true };
const years: AcademicYear[] = [{ id: "2026", displayName: "2026학년도", active: true, isCurrent: true }, { id: "2027", displayName: "2027학년도", active: true, isCurrent: false }];
const grades: Grade[] = [
  { id: "2026-1", academicYearId: "2026", gradeNumber: 1, displayName: "1학년", active: true },
  { id: "2026-2", academicYearId: "2026", gradeNumber: 2, displayName: "2학년", active: true },
  { id: "2027-1", academicYearId: "2027", gradeNumber: 1, displayName: "1학년", active: true },
];

describe("annual grade scope", () => {
  it("keeps system owner global while teacher membership is year and grade specific", () => {
    expect(isScopeSelectable(owner, assignments, { academicYearId: "2026", gradeId: null })).toBe(true);
    expect(hasGradeAssignment(assignments, "teacher", "2026", "2026-2")).toBe(true);
    expect(hasGradeAssignment(assignments, "teacher", "2026", "2026-3")).toBe(false);
    expect(hasGradeAssignment(assignments, "teacher", "2027", "2027-1")).toBe(true);
    expect(hasGradeAssignment(assignments, "teacher", "2027", "2026-1")).toBe(false);
  });

  it("selects an active current-year grade and rejects a non-assigned grade", () => {
    expect(chooseInitialScope(years, grades, assignments, teacher)).toEqual({ academicYearId: "2026", gradeId: "2026-1" });
    expect(isScopeSelectable(teacher, assignments, { academicYearId: "2026", gradeId: "2026-1" })).toBe(true);
    expect(isScopeSelectable(teacher, assignments, { academicYearId: "2026", gradeId: "2026-3" })).toBe(false);
    expect(isScopeSelectable(teacher, assignments, { academicYearId: "2026", gradeId: null })).toBe(false);
  });

  it("uses whole-year scope only for the system owner and rejects stale persisted scopes", () => {
    expect(chooseInitialSchoolScope(years, grades, assignments, owner)).toEqual({ academicYearId: "2026", gradeId: null });
    expect(chooseInitialSchoolScope(years, grades, assignments, teacher)).toEqual({ academicYearId: "2026", gradeId: "2026-1" });
    expect(isValidSchoolScope(years, grades, assignments, teacher, { academicYearId: "2026", gradeId: "2026-2" })).toBe(true);
    expect(isValidSchoolScope(years, grades, assignments, teacher, { academicYearId: "2027", gradeId: "2026-2" })).toBe(false);
    expect(isValidSchoolScope(years, grades, assignments, teacher, { academicYearId: "2027", gradeId: "2027-1" })).toBe(true);
  });

  it("keeps navigation limited to scoped roles", () => {
    expect(visibleNavigation(owner, assignments, { academicYearId: "2026", gradeId: null }).some((item) => item.to === "/admin")).toBe(true);
    expect(visibleNavigation(administrator, assignments, { academicYearId: "2026", gradeId: "2026-2" }).some((item) => item.to === "/students")).toBe(true);
    expect(visibleNavigation(teacher, assignments, { academicYearId: "2026", gradeId: "2026-1" }).some((item) => item.to === "/students")).toBe(false);
  });

  it("limits grade administrator authority to the assigned grade", () => {
    expect(isGradeAdminForGrade(assignments, "admin", "2026", "2026-2")).toBe(true);
    expect(isGradeAdminForGrade(assignments, "admin", "2026", "2026-1")).toBe(false);
    expect(isTeacherForGrade(assignments, "teacher", "2026", "2026-2")).toBe(true);
  });

  it("allows homeroom access only for the matching class and annual assignment", () => {
    expect(canAssignHomeroomTeacher(classroom, assignments, teacher.uid)).toBe(true);
    expect(canReadClass(teacher, classroom, assignments)).toBe(true);
    expect(canViewClassStatistics(teacher, classroom, assignments)).toBe(true);
    expect(canReadClass(teacher, { ...classroom, id: "2026-2-4", homeroomTeacherUid: "other" }, assignments)).toBe(true);
    expect(canViewClassStatistics(teacher, { ...classroom, id: "2026-2-4", homeroomTeacherUid: "other" }, assignments)).toBe(false);
    expect(canAssignHomeroomTeacher({ ...classroom, gradeId: "2026-1" }, assignments, teacher.uid)).toBe(true);
    expect(canAssignHomeroomTeacher({ ...classroom, academicYearId: "2027", gradeId: "2027-2" }, assignments, teacher.uid)).toBe(false);
  });

  it("applies school and grade exceptions without leaking to another grade", () => {
    expect(exceptionAppliesToScope({ academicYearId: "2026", scopeType: "school" }, { academicYearId: "2026", gradeId: "2026-1" })).toBe(true);
    expect(exceptionAppliesToScope({ academicYearId: "2026", scopeType: "grade", gradeId: "2026-2" }, { academicYearId: "2026", gradeId: "2026-2" })).toBe(true);
    expect(exceptionAppliesToScope({ academicYearId: "2026", scopeType: "grade", gradeId: "2026-2" }, { academicYearId: "2026", gradeId: "2026-1" })).toBe(false);
    expect(exceptionAppliesToScope({ academicYearId: "2026", scopeType: "school", active: false }, { academicYearId: "2026", gradeId: "2026-1" })).toBe(false);
  });
});
