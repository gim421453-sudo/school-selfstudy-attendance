import type { AppUser, ClassRoom, StaffAssignment } from "./types/domain";
import { hasGlobalOwnerRole, isGradeAdminForGrade, isHomeroomTeacherForClass } from "./domain/scope";

export type NavigationItem = { to: string; label: string; ownerOnly?: boolean; gradeAdmin?: boolean; homeroom?: boolean; homeroomOrOwner?: boolean; selfStudyAttendance?: boolean; selfStudyHistory?: boolean };
export const navigationItems: NavigationItem[] = [
  { to: "/", label: "\uB300\uC2DC\uBCF4\uB4DC" },
  { to: "/self-study-attendance", label: "\uC790\uC2B5 \uCD9C\uACB0", selfStudyAttendance: true },
  { to: "/my-supervision", label: "\uAC10\uB3C5\uAD50\uC0AC \uC77C\uC815", selfStudyAttendance: true },
  { to: "/self-study-history", label: "\uC790\uC2B5 \uCD9C\uACB0 \uC774\uB825", selfStudyHistory: true },
  { to: "/self-study-statistics", label: "\uC790\uC2B5 \uCD9C\uACB0 \uD1B5\uACC4", selfStudyHistory: true },
  { to: "/self-study-permissions", label: "\uC790\uC2B5 \uD5C8\uB77D", homeroomOrOwner: true },
  { to: "/students", label: "\uD559\uC0DD \uBA85\uBD80", gradeAdmin: true },
  { to: "/classes", label: "\uD559\uAE09 / \uB2F4\uC784 \uAD00\uB9AC", gradeAdmin: true },
  { to: "/periods", label: "\uC790\uC2B5 \uC2DC\uAC04\uD45C \uAD00\uB9AC", gradeAdmin: true },
  { to: "/self-study-groups", label: "\uC790\uC2B5\uADF8\uB8F9 / \uC790\uC2B5\uC2E4 \uAD00\uB9AC", gradeAdmin: true },
  { to: "/supervision", label: "\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815", gradeAdmin: true },
  { to: "/self-study-exceptions", label: "\uC790\uC2B5 \uC6B4\uC601 \uC608\uC678\uC77C", gradeAdmin: true },
  { to: "/audit", label: "\uAC10\uC0AC \uAE30\uB85D", gradeAdmin: true },
  { to: "/admin", label: "\uC2DC\uC2A4\uD15C \uAD00\uB9AC\uC790", ownerOnly: true },
  { to: "/admin/staff", label: "\uAD50\uC9C1\uC6D0 / \uAD8C\uD55C \uAD00\uB9AC", ownerOnly: true },
  { to: "/admin/operations", label: "\uC2DC\uC2A4\uD15C \uC6B4\uC601 / \uBE44\uC0C1 \uBAA8\uB4DC", ownerOnly: true },
];

export function visibleNavigation(user: AppUser | null, assignments: StaffAssignment[], scope: { academicYearId: string; gradeId: string | null } | null, classes: ClassRoom[] = []) {
  if (!user || !scope) return [];
  const owner = hasGlobalOwnerRole(user); const admin = Boolean(scope.gradeId && isGradeAdminForGrade(assignments, user.uid, scope.academicYearId, scope.gradeId));
  const homeroom = Boolean(scope.gradeId && classes.some((classRoom) => isHomeroomTeacherForClass(classRoom, assignments, user.uid)));
  const assigned = Boolean(scope.gradeId && assignments.some((assignment) => assignment.active && assignment.academicYearId === scope.academicYearId && assignment.gradeId === scope.gradeId && assignment.uid === user.uid));
  return navigationItems.filter((item) => !item.ownerOnly || owner).filter((item) => !item.gradeAdmin || owner || admin).filter((item) => !item.homeroom || homeroom).filter((item) => !item.homeroomOrOwner || owner || homeroom).filter((item) => !item.selfStudyAttendance || owner || admin || assigned).filter((item) => !item.selfStudyHistory || owner || admin || homeroom);
}
