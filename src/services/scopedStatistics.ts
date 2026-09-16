import { summarizeAttendance, type AttendanceSummary, type StatisticsGroup } from "../domain/statistics";
import type { AttendanceRecord, ScopedStudent } from "../types/domain";
import { getApplicableExceptions } from "./scopedExceptions";
import { getClass } from "./classes";
import { listScopedStudents } from "./scopedStudents";
import { listScopedAttendanceHistory, type AttendanceScope } from "./scopedAttendance";

export interface StatisticsFilter extends AttendanceScope {
  startDate: string;
  endDate: string;
  classId?: string;
  studentId?: string;
  periodId?: string;
  includeInactiveStudents?: boolean;
}

export interface ScopedStatisticsResult {
  records: AttendanceRecord[];
  students: ScopedStudent[];
  excludedDates: Set<string>;
}

export async function getScopedStatisticsData(filter: StatisticsFilter): Promise<ScopedStatisticsResult> {
  if (filter.classId) {
    const classRoom = await getClass(filter.classId);
    if (!classRoom?.academicYearId || classRoom.academicYearId !== filter.academicYearId || classRoom.gradeId !== filter.gradeId) {
      throw new Error("반 scope가 선택한 학년도/학년과 일치하지 않습니다.");
    }
  }
  const [history, students, exceptions] = await Promise.all([
    listScopedAttendanceHistory({ ...filter, pageSize: 500 }),
    listScopedStudents({ academicYearId: filter.academicYearId, gradeId: filter.gradeId, ...(filter.classId ? { classId: filter.classId } : {}) }),
    getApplicableExceptions(filter.academicYearId, filter.gradeId, { start: filter.startDate, end: filter.endDate }),
  ]);
  const records = history.records.filter((record) => (!filter.studentId || record.studentId === filter.studentId) && (!filter.periodId || record.periodId === filter.periodId));
  return { records, students, excludedDates: new Set(exceptions.map((exception) => exception.date)) };
}

export async function getGradeStatistics(filter: StatisticsFilter): Promise<AttendanceSummary[]> {
  const data = await getScopedStatisticsData(filter);
  return summarizeAttendance(data.records, "class", data.students, filter.includeInactiveStudents, data.excludedDates);
}

export async function getClassStatistics(filter: StatisticsFilter & { classId: string }): Promise<AttendanceSummary[]> {
  const data = await getScopedStatisticsData(filter);
  return summarizeAttendance(data.records, "student", data.students, filter.includeInactiveStudents, data.excludedDates);
}

export async function getStudentStatistics(filter: StatisticsFilter & { studentId: string }): Promise<AttendanceSummary[]> {
  const data = await getScopedStatisticsData(filter);
  return summarizeAttendance(data.records, "period", data.students, filter.includeInactiveStudents, data.excludedDates);
}

export async function getPeriodStatistics(filter: StatisticsFilter & { periodId: string }): Promise<AttendanceSummary[]> {
  const data = await getScopedStatisticsData(filter);
  return summarizeAttendance(data.records, "class", data.students, filter.includeInactiveStudents, data.excludedDates);
}

export function scopedAttendanceExportMetadata(scope: AttendanceScope): { academicYearId: string; gradeId: string; label: string } {
  return { ...scope, label: `${scope.academicYearId}학년도 ${scope.gradeId}학년` };
}

export const summarizeScopedStatistics = (records: AttendanceRecord[], group: StatisticsGroup, students: ScopedStudent[], excludedDates: Set<string>, includeInactive = false) => summarizeAttendance(records, group, students, includeInactive, excludedDates);
