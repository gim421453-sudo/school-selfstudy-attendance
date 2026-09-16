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

export function makeStaffAssignmentId(academicYearId: string, gradeId: string, uid: string): string {
  const year = assertIdPart(academicYearId, "학년도");
  const grade = assertIdPart(gradeId, "학년");
  const user = assertIdPart(uid, "교직원");
  return `${year}_${grade}_${user}`;
}
