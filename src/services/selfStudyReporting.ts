import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { SelfStudyAttendanceRecord, SelfStudyAttendanceStatus } from "../types/domain";

export interface SelfStudyReportScope { academicYearId: string; gradeId: string; }
export interface SelfStudyHistoryFilter extends SelfStudyReportScope { startDate: string; endDate: string; classId?: string; selfStudyGroupId?: string; periodId?: string; studentId?: string; status?: SelfStudyAttendanceStatus; }
export interface SelfStudyAttendanceCounts { total: number; present: number; excused: number; unexcused: number; }

export async function listSelfStudyAttendanceHistory(filter: SelfStudyHistoryFilter): Promise<SelfStudyAttendanceRecord[]> {
  const constraints = [where("academicYearId", "==", filter.academicYearId), where("gradeId", "==", filter.gradeId), where("date", ">=", filter.startDate), where("date", "<=", filter.endDate)];
  const snapshot = await getDocs(query(collection(db, "selfStudyAttendanceRecords"), ...constraints, orderBy("date", "desc"), orderBy("periodId"), orderBy("studentId")));
  return snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<SelfStudyAttendanceRecord, "id">) })).filter((record) =>
    (!filter.classId || record.classId === filter.classId)
    && (!filter.selfStudyGroupId || record.selfStudyGroupId === filter.selfStudyGroupId)
    && (!filter.periodId || record.periodId === filter.periodId)
    && (!filter.studentId || record.studentId === filter.studentId)
    && (!filter.status || record.status === filter.status),
  );
}

export function summarizeSelfStudyAttendance(records: SelfStudyAttendanceRecord[]): SelfStudyAttendanceCounts {
  return records.reduce<SelfStudyAttendanceCounts>((counts, record) => {
    counts.total += 1;
    if (record.status === "PRESENT") counts.present += 1;
    if (record.status === "EXCUSED_ABSENCE") counts.excused += 1;
    if (record.status === "UNEXCUSED_ABSENCE") counts.unexcused += 1;
    return counts;
  }, { total: 0, present: 0, excused: 0, unexcused: 0 });
}

export function summarizeSelfStudyAttendanceBy<T extends string>(records: SelfStudyAttendanceRecord[], key: (record: SelfStudyAttendanceRecord) => T): Map<T, SelfStudyAttendanceCounts> {
  const result = new Map<T, SelfStudyAttendanceCounts>();
  records.forEach((record) => {
    const group = key(record); const current = result.get(group) ?? { total: 0, present: 0, excused: 0, unexcused: 0 };
    current.total += 1;
    if (record.status === "PRESENT") current.present += 1;
    if (record.status === "EXCUSED_ABSENCE") current.excused += 1;
    if (record.status === "UNEXCUSED_ABSENCE") current.unexcused += 1;
    result.set(group, current);
  });
  return result;
}
