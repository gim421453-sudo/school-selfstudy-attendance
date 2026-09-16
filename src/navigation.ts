import type { AppUser, ClassRoom, StaffAssignment } from "./types/domain";
import { hasGlobalOwnerRole, isGradeAdminForGrade, isHomeroomTeacherForClass } from "./domain/scope";

export type NavigationItem = { to: string; label: string; ownerOnly?: boolean; gradeAdmin?: boolean; homeroom?: boolean };
export const navigationItems: NavigationItem[] = [
  { to: "/", label: "대시보드" }, { to: "/attendance", label: "출결 관리" }, { to: "/history", label: "이전 출결" }, { to: "/duty", label: "담당교사 일정" },
  { to: "/students", label: "학생 명부", gradeAdmin: true }, { to: "/classes", label: "반/담임 관리", gradeAdmin: true }, { to: "/periods", label: "자습 교시 관리", gradeAdmin: true },
  { to: "/stats", label: "출결 통계", gradeAdmin: true }, { to: "/audit", label: "감사 기록", gradeAdmin: true }, { to: "/admin", label: "전체 관리", ownerOnly: true },
];
export function visibleNavigation(user: AppUser | null, assignments: StaffAssignment[], scope: { academicYearId: string; gradeId: string | null } | null, classes: ClassRoom[] = []) {
  if (!user || !scope) return [];
  const owner = hasGlobalOwnerRole(user); const admin = Boolean(scope.gradeId && isGradeAdminForGrade(assignments, user.uid, scope.academicYearId, scope.gradeId));
  const homeroom = Boolean(scope.gradeId && classes.some((classRoom) => isHomeroomTeacherForClass(classRoom, assignments, user.uid)));
  return navigationItems.filter((item) => !item.ownerOnly || owner).filter((item) => !item.gradeAdmin || owner || admin).filter((item) => !item.homeroom || homeroom);
}
