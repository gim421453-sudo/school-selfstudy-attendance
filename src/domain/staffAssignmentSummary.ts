import type { Grade, StaffAssignment } from "../types/domain";

export interface GradeStaffAssignmentSummary {
  gradeId: string;
  gradeName: string;
  assignedCount: number;
  gradeAdminCount: number;
  teacherCount: number;
  assignments: StaffAssignment[];
}

/** Display-only grouping. Roles and authorization remain evaluated from source assignments. */
export function summarizeStaffAssignmentsByGrade(grades: Grade[], assignments: StaffAssignment[], academicYearId: string): GradeStaffAssignmentSummary[] {
  return grades.filter((grade) => grade.academicYearId === academicYearId && grade.active).map((grade) => {
    const active = assignments.filter((assignment) => assignment.academicYearId === academicYearId && assignment.gradeId === grade.id && assignment.active);
    return { gradeId: grade.id, gradeName: grade.displayName, assignedCount: active.length, gradeAdminCount: active.filter((assignment) => assignment.role === "grade_admin").length, teacherCount: active.filter((assignment) => assignment.role === "teacher").length, assignments: active };
  });
}
