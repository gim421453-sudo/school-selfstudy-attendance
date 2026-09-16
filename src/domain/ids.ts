function assertIdPart(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes("/")) {
    throw new Error(`${label} ID는 비어 있거나 / 문자를 포함할 수 없습니다.`);
  }
  return normalized;
}

export function makeGradeId(academicYearId: string, gradeNumber: number): string {
  const year = assertIdPart(academicYearId, "학년도");
  if (!Number.isInteger(gradeNumber) || gradeNumber < 1) {
    throw new Error("학년은 1 이상의 정수여야 합니다.");
  }
  return `${year}-${gradeNumber}`;
}

export function makeClassId(academicYearId: string, gradeId: string, classNumber: number): string {
  const year = assertIdPart(academicYearId, "academic year");
  const grade = assertIdPart(gradeId, "grade");
  if (!Number.isInteger(classNumber) || classNumber < 1) throw new Error("Class number must be a positive integer.");
  return `${year}_${grade}_${classNumber}`;
}

export function makeStaffAssignmentId(academicYearId: string, gradeId: string, uid: string): string {
  const year = assertIdPart(academicYearId, "학년도");
  const grade = assertIdPart(gradeId, "학년");
  const user = assertIdPart(uid, "교직원");
  return `${year}_${grade}_${user}`;
}

export function makeSelfStudyGroupPeriodId(groupId: string, periodId: string): string {
  return `${assertIdPart(groupId, "group")}_${assertIdPart(periodId, "period")}`;
}

export function makeSelfStudyMembershipId(academicYearId: string, gradeId: string, studentId: string): string {
  return `${assertIdPart(academicYearId, "academic year")}_${assertIdPart(gradeId, "grade")}_${assertIdPart(studentId, "student")}`;
}

export function makeDutyAssignmentId(gradeId: string, date: string): string {
  const grade = assertIdPart(gradeId, "학년");
  const normalizedDate = assertIdPart(date, "날짜");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) throw new Error("날짜는 YYYY-MM-DD 형식이어야 합니다.");
  return `${grade}_${normalizedDate}`;
}

export function makeAttendanceDayId(gradeId: string, date: string): string {
  return makeDutyAssignmentId(gradeId, date);
}

export function makeSupervisionAssignmentId(gradeId: string, date: string, periodId: string, groupId: string, teacherUid: string): string {
  return `${makeDutyAssignmentId(gradeId, date)}_${assertIdPart(periodId, "period")}_${assertIdPart(groupId, "group")}_${assertIdPart(teacherUid, "teacher")}`;
}

export function makeSelfStudyPermissionId(academicYearId: string, gradeId: string, studentId: string, date: string): string {
  return `${assertIdPart(academicYearId, "academic year")}_${makeDutyAssignmentId(gradeId, date)}_${assertIdPart(studentId, "student")}`;
}

export function makeSelfStudyAttendanceRecordId(academicYearId: string, gradeId: string, date: string, periodId: string, studentId: string): string {
  return `${assertIdPart(academicYearId, "academic year")}_${makeDutyAssignmentId(gradeId, date)}_${assertIdPart(periodId, "period")}_${assertIdPart(studentId, "student")}`;
}

export function makeAttendanceRecordId(classId: string, periodId: string, studentId: string): string {
  return `${assertIdPart(classId, "반")}__${assertIdPart(periodId, "교시")}__${assertIdPart(studentId, "학생")}`;
}
