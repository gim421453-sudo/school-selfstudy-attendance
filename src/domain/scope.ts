import type { AcademicYear, AppUser, ClassRoom, Grade, SchoolScope, Scope, StaffAssignment, Student } from "../types/domain";

export const scopedId = (scope: Scope, suffix: string) => `${scope.academicYearId}_${scope.gradeId}_${suffix}`;
export const gradeDateId = (scope: Scope, date: string) => `${scope.gradeId}_${date}`;

export function hasGlobalOwnerRole(user: AppUser | null): boolean {
  // Old documents remain readable while a system owner is migrated explicitly.
  return Boolean(user?.active && (user.globalRoles?.includes("system_owner") || user.roles?.includes("system_owner")));
}

export const isSystemOwner = hasGlobalOwnerRole;

export function currentAcademicYearInitializationError(years: AcademicYear[]): string | null {
  const currentYears = years.filter((year) => year.active && year.isCurrent);
  if (currentYears.length === 1) return null;
  return currentYears.length === 0
    ? "활성 현재 학년도가 지정되어 있지 않습니다."
    : "활성 현재 학년도가 여러 개입니다. 학교 운영 설정을 확인해 주세요.";
}

function currentActiveAcademicYear(years: AcademicYear[]): AcademicYear | null {
  return currentAcademicYearInitializationError(years) === null
    ? years.find((year) => year.active && year.isCurrent) ?? null
    : null;
}

export function assignmentMatchesScope(assignment: StaffAssignment, scope: Scope): boolean {
  return assignment.active && assignment.academicYearId === scope.academicYearId && assignment.gradeId === scope.gradeId;
}

export function hasGradeAssignment(assignments: StaffAssignment[], uid: string, academicYearId: string, gradeId: string): boolean {
  return assignments.some((assignment) => assignment.uid === uid && assignmentMatchesScope(assignment, { academicYearId, gradeId }));
}

export function isTeacherForGrade(assignments: StaffAssignment[], uid: string, academicYearId: string, gradeId: string): boolean {
  return assignments.some((assignment) => assignment.uid === uid && assignment.role === "teacher" && assignmentMatchesScope(assignment, { academicYearId, gradeId }));
}

export function isGradeAdminForGrade(assignments: StaffAssignment[], uid: string, academicYearId: string, gradeId: string): boolean {
  return assignments.some((assignment) => assignment.uid === uid && assignment.role === "grade_admin" && assignmentMatchesScope(assignment, { academicYearId, gradeId }));
}

export function isHomeroomTeacherForClass(classRoom: ClassRoom | null, assignments: StaffAssignment[], uid: string): boolean {
  return Boolean(classRoom?.academicYearId && classRoom.gradeId && classRoom.homeroomTeacherUid === uid
    && hasGradeAssignment(assignments, uid, classRoom.academicYearId, classRoom.gradeId));
}

/** A homeroom candidate must already be active in the same annual grade scope. */
export function canAssignHomeroomTeacher(classRoom: ClassRoom | null, assignments: StaffAssignment[], uid: string): boolean {
  return isHomeroomTeacherForClass({ ...classRoom, homeroomTeacherUid: uid } as ClassRoom, assignments, uid);
}

export function canReadClass(user: AppUser | null, classRoom: ClassRoom | null, assignments: StaffAssignment[]): boolean {
  if (!user?.active || !classRoom?.academicYearId || !classRoom.gradeId) return false;
  return isSystemOwner(user)
    || hasGradeAssignment(assignments, user.uid, classRoom.academicYearId, classRoom.gradeId)
    || isHomeroomTeacherForClass(classRoom, assignments, user.uid);
}

export function canViewClassStatistics(user: AppUser | null, classRoom: ClassRoom | null, assignments: StaffAssignment[]): boolean {
  if (!user?.active || !classRoom?.academicYearId || !classRoom.gradeId) return false;
  return isSystemOwner(user)
    || isGradeAdminForGrade(assignments, user.uid, classRoom.academicYearId, classRoom.gradeId)
    || isHomeroomTeacherForClass(classRoom, assignments, user.uid);
}

export function isScopeSelectable(user: AppUser | null, assignments: StaffAssignment[], scope: SchoolScope): boolean {
  if (!user?.active) return false;
  if (scope.gradeId === null) return isSystemOwner(user);
  return isSystemOwner(user) || hasGradeAssignment(assignments, user.uid, scope.academicYearId, scope.gradeId);
}

export function exceptionAppliesToScope(exception: { academicYearId?: string; gradeId?: string | null; scopeType?: "school" | "grade"; active?: boolean; enabled?: boolean }, scope: Scope): boolean {
  if (exception.active === false || exception.enabled === false) return false;
  if (exception.academicYearId !== scope.academicYearId) return false;
  return exception.scopeType === "school" || (exception.scopeType === "grade" && exception.gradeId === scope.gradeId);
}

export function assignedScopes(assignments: StaffAssignment[], uid: string): Scope[] {
  const unique = new Map<string, Scope>();
  assignments.filter((assignment) => assignment.uid === uid && assignment.active).forEach((assignment) => {
    unique.set(`${assignment.academicYearId}/${assignment.gradeId}`, { academicYearId: assignment.academicYearId, gradeId: assignment.gradeId });
  });
  return [...unique.values()];
}

export function filterGradesForYear(grades: Grade[], academicYearId: string) {
  return grades.filter((grade) => grade.academicYearId === academicYearId && grade.active);
}

export function filterStudentsForScope(students: Student[], scope: Scope) {
  return students.filter((student) => student.academicYearId === scope.academicYearId && student.gradeId === scope.gradeId);
}

export function filterClassesForScope(classes: ClassRoom[], scope: Scope) {
  return classes.filter((classRoom) => classRoom.academicYearId === scope.academicYearId && classRoom.gradeId === scope.gradeId);
}

export function chooseInitialScope(years: AcademicYear[], grades: Grade[], assignments: StaffAssignment[], user: AppUser | null): Scope | null {
  const year = currentActiveAcademicYear(years);
  if (!year) return null;
  const eligibleGrades = hasGlobalOwnerRole(user)
    ? filterGradesForYear(grades, year.id)
    : filterGradesForYear(grades, year.id).filter((grade) => assignments.some((assignment) => assignment.uid === user?.uid && assignmentMatchesScope(assignment, { academicYearId: year.id, gradeId: grade.id })));
  const grade = eligibleGrades[0];
  return grade ? { academicYearId: year.id, gradeId: grade.id } : null;
}


export function chooseInitialSchoolScope(years: AcademicYear[], grades: Grade[], assignments: StaffAssignment[], user: AppUser | null): SchoolScope | null {
  const year = currentActiveAcademicYear(years);
  if (!year) return null;
  if (hasGlobalOwnerRole(user)) return { academicYearId: year.id, gradeId: null };
  return chooseInitialScope(years, grades, assignments, user);
}

export function isValidSchoolScope(years: AcademicYear[], grades: Grade[], assignments: StaffAssignment[], user: AppUser | null, scope: SchoolScope | null): scope is SchoolScope {
  if (!scope || !isScopeSelectable(user, assignments, scope)) return false;
  if (!years.some((year) => year.id === scope.academicYearId && year.active)) return false;
  return scope.gradeId === null || grades.some((grade) => grade.id === scope.gradeId && grade.academicYearId === scope.academicYearId && grade.active);
}

export function resolveSchoolScope(years: AcademicYear[], grades: Grade[], assignments: StaffAssignment[], user: AppUser | null, stored: SchoolScope | null): SchoolScope | null {
  if (hasGlobalOwnerRole(user)) return chooseInitialSchoolScope(years, grades, assignments, user);
  return isValidSchoolScope(years, grades, assignments, user, stored)
    ? stored
    : chooseInitialSchoolScope(years, grades, assignments, user);
}

export function hasConcreteGradeScope(scope: SchoolScope | null): scope is Scope {
  return Boolean(scope?.gradeId);
}

export function scopeBootstrapView(loading: boolean, error: string | null, scope: SchoolScope | null): "loading" | "error" | "missing" | "ready" {
  if (loading) return "loading";
  if (error) return "error";
  return scope ? "ready" : "missing";
}
