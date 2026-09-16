import type { AttendanceRecord, AttendanceStatus, Student } from "../types/domain";
import { isSelfStudyDay } from "./schedule";

export type StatisticsGroup = "class" | "student" | "period";

export interface AttendanceSummary {
  key: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  early_leave: number;
  total: number;
  credited: number;
  rate: number;
}

export function summarizeAttendance(records: AttendanceRecord[], group: StatisticsGroup, students: Student[], includeInactive = false, excludedDates = new Set<string>()): AttendanceSummary[] {
  const activeIds = new Set(students.filter((student) => includeInactive || student.active).map((student) => student.id));
  const summaries = new Map<string, AttendanceSummary>();
  for (const record of records) {
    if (!isSelfStudyDay(record.date) || excludedDates.has(record.date)) continue;
    if (!activeIds.has(record.studentId)) continue;
    const key = group === "class" ? record.classId : group === "student" ? record.studentId : record.periodId;
    const row = summaries.get(key) ?? { key, present: 0, late: 0, absent: 0, excused: 0, early_leave: 0, total: 0, credited: 0, rate: 0 };
    row[record.status as AttendanceStatus] += 1;
    row.total += 1;
    if (record.status === "present" || record.status === "excused") row.credited += 1;
    summaries.set(key, row);
  }
  return [...summaries.values()].map((row) => ({ ...row, rate: row.total ? (row.credited / row.total) * 100 : 0 }));
}
