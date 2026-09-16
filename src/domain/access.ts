import type { AccessSettings, AppUser, ClassRoom, DutyAssignment, Scope, StaffAssignment } from "../types/domain";
import { assignmentMatchesScope, hasGlobalOwnerRole } from "./scope";

export function hasRole(user: AppUser | null, role: "system_owner") {
  return role === "system_owner" && hasGlobalOwnerRole(user);
}

export function isOwner(user: AppUser | null) {
  return hasRole(user, "system_owner");
}

export function isGradeAdmin(user: AppUser | null) {
  // v0.6 compatibility only. New scope-aware callers must use isScopedGradeAdmin.
  return isOwner(user) || Boolean(user?.active && user.roles?.includes("grade_admin"));
}

export function hasActiveStaffAssignment(user: AppUser | null, assignments: StaffAssignment[], scope: Scope) {
  return Boolean(user?.active && (isOwner(user) || assignments.some((assignment) => assignment.uid === user.uid && assignmentMatchesScope(assignment, scope))));
}

export function isScopedGradeAdmin(user: AppUser | null, assignments: StaffAssignment[], scope: Scope) {
  return Boolean(user?.active && (isOwner(user) || assignments.some((assignment) => assignment.uid === user.uid && assignment.role === "grade_admin" && assignmentMatchesScope(assignment, scope))));
}

export function isScopedHomeroomTeacher(user: AppUser | null, classRoom: ClassRoom | null, assignments: StaffAssignment[], scope: Scope) {
  return Boolean(classRoom && user?.active && classRoom.homeroomTeacherUid === user.uid && hasActiveStaffAssignment(user, assignments, scope));
}

export function isHomeroomTeacher(user: AppUser | null) {
  return Boolean(user?.active && user.homeroomClassId);
}

export function canManageAttendance(
  user: AppUser | null,
  duty: DutyAssignment | null,
  periodId: string,
  assignments: StaffAssignment[] = [],
  scope?: Scope,
) {
  if (!user?.active) return false;
  if (!scope) return isGradeAdmin(user) || duty?.periods[periodId]?.teacherUid === user.uid;
  return isScopedGradeAdmin(user, assignments, scope)
    || (hasActiveStaffAssignment(user, assignments, scope) && duty?.academicYearId === scope.academicYearId && duty?.gradeId === scope.gradeId && duty?.periods[periodId]?.teacherUid === user.uid);
}

export function canViewStats(
  user: AppUser | null,
  settings: AccessSettings | null,
  assignments: StaffAssignment[] = [],
  scope?: Scope,
) {
  if (!scope) return Boolean(user?.active && settings && isGradeAdmin(user));
  return Boolean(user?.active && settings && isScopedGradeAdmin(user, assignments, scope));
}
