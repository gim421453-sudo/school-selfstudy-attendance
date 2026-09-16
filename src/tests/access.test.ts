import { describe, expect, it } from "vitest";
import { canManageAttendance, canViewStats } from "../domain/access";
import type { AccessSettings, AppUser, DutyAssignment } from "../types/domain";

const teacher: AppUser = { uid: "teacher-1", email: "teacher@example.com", displayName: "Teacher", roles: ["teacher"], active: true };
const otherTeacher: AppUser = { ...teacher, uid: "teacher-2" };
const homeroom: AppUser = { ...teacher, uid: "homeroom-1", roles: ["teacher", "homeroom_teacher"], homeroomClassId: "2-1" };
const gradeAdmin: AppUser = { ...teacher, uid: "grade-admin-1", roles: ["teacher", "grade_admin"] };
const duty: DutyAssignment = { date: "2026-09-15", periods: { p1: { teacherUid: "teacher-1", teacherName: "Teacher" }, p2: { teacherUid: "teacher-2", teacherName: "Other" }, p3: { teacherUid: "teacher-1", teacherName: "Teacher" } } };
const restricted: AccessSettings = { statsVisibility: "grade_admin_only", homeroomStatsScope: "own_class" };

describe("attendance permission", () => {
  it("allows only matching period assignments and grade admins", () => {
    expect(canManageAttendance(teacher, duty, "p1")).toBe(true);
    expect(canManageAttendance(teacher, duty, "p2")).toBe(false);
    expect(canManageAttendance(teacher, duty, "p3")).toBe(true);
    expect(canManageAttendance(otherTeacher, duty, "p2")).toBe(true);
    expect(canManageAttendance(gradeAdmin, duty, "p2")).toBe(true);
  });
});

describe("statistics permission", () => {
  it("allows grade admins only", () => {
    expect(canViewStats(gradeAdmin, restricted)).toBe(true);
    expect(canViewStats(homeroom, { ...restricted, statsVisibility: "grade_admin_and_homeroom" })).toBe(false);
  });
});
