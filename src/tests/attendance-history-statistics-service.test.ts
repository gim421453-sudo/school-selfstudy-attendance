import { describe, expect, it } from "vitest";
import { makeAttendanceDayId, makeAttendanceRecordId } from "../domain/ids";
import { isScopedSelfStudyDate } from "../domain/schedule";
import { auditEventData } from "../services/audit";
import { scopedAttendanceExportMetadata, summarizeScopedStatistics } from "../services/scopedStatistics";
import type { AttendanceRecord, ScopedStudent } from "../types/domain";

const students: ScopedStudent[] = [
  { id: "s1", academicYearId: "2026", gradeId: "2026-2", classId: "c1", studentNo: 1, name: "A", active: true },
  { id: "s2", academicYearId: "2026", gradeId: "2026-2", classId: "c1", studentNo: 2, name: "B", active: false },
];
const records: AttendanceRecord[] = [
  { id: "r1", academicYearId: "2026", gradeId: "2026-2", date: "2026-09-14", classId: "c1", studentId: "s1", periodId: "p1", status: "present", note: "", markedBy: "teacher", markedAt: null, updatedAt: null },
  { id: "r2", academicYearId: "2026", gradeId: "2026-2", date: "2026-09-15", classId: "c1", studentId: "s1", periodId: "p1", status: "excused", note: "", markedBy: "teacher", markedAt: null, updatedAt: null },
  { id: "r3", academicYearId: "2026", gradeId: "2026-2", date: "2026-09-16", classId: "c1", studentId: "s1", periodId: "p1", status: "absent", note: "", markedBy: "teacher", markedAt: null, updatedAt: null },
  { id: "r4", academicYearId: "2026", gradeId: "2026-2", date: "2026-09-20", classId: "c1", studentId: "s1", periodId: "p1", status: "present", note: "", markedBy: "teacher", markedAt: null, updatedAt: null },
  { id: "r5", academicYearId: "2026", gradeId: "2026-2", date: "2026-09-14", classId: "c1", studentId: "s2", periodId: "p1", status: "present", note: "", markedBy: "teacher", markedAt: null, updatedAt: null },
];

describe("scoped attendance, history, and statistics contracts", () => {
  it("uses grade/date day IDs and stable record IDs", () => {
    expect(makeAttendanceDayId("2026-2", "2026-09-14")).toBe("2026-2_2026-09-14");
    expect(makeAttendanceRecordId("c1", "p1", "s1")).toBe("c1__p1__s1");
  });

  it("calculates present plus excused over recorded attendance, excluding Sunday and inactive students", () => {
    const summary = summarizeScopedStatistics(records, "class", students, new Set()).find((item) => item.key === "c1")!;
    expect(summary.total).toBe(3);
    expect(summary.credited).toBe(2);
    expect(summary.rate).toBeCloseTo(66.666, 2);
  });

  it("excludes school or selected-grade exceptions without treating unmarked dates as absences", () => {
    const summary = summarizeScopedStatistics(records, "student", students, new Set(["2026-09-15"])).find((item) => item.key === "s1")!;
    expect(summary.total).toBe(2);
    expect(summary.absent).toBe(1);
    expect(isScopedSelfStudyDate("2026-09-16", [{ active: true }])).toBe(false);
    expect(isScopedSelfStudyDate("2026-09-16", [])).toBe(true);
  });

  it("exposes selected scope in Excel export metadata and attendance audit", () => {
    expect(scopedAttendanceExportMetadata({ academicYearId: "2026", gradeId: "2026-2" })).toMatchObject({ academicYearId: "2026", gradeId: "2026-2" });
    expect(auditEventData({ actor: { uid: "teacher", name: "Teacher" }, action: "ATTENDANCE_CREATED", targetType: "attendance", targetId: "r1", academicYearId: "2026", gradeId: "2026-2", classId: "c1", studentId: "s1", periodId: "p1", dutyDate: "2026-09-14" })).toMatchObject({ classId: "c1", studentId: "s1", periodId: "p1", dutyDate: "2026-09-14" });
  });
});
