import { describe, expect, it } from "vitest";
import { makeSelfStudyExceptionId } from "../domain/ids";
import { isScopedSelfStudyDate } from "../domain/schedule";
import { summarizeSelfStudyAttendance, summarizeSelfStudyAttendanceBy } from "../services/selfStudyReporting";
import type { SelfStudyAttendanceRecord } from "../types/domain";

const base = { academicYearId: "2026", gradeId: "g2", date: "2026-09-18", periodId: "p1", classId: "c1", selfStudyGroupId: "group-a", recordedByUid: "teacher", updatedByUid: "teacher", schemaVersion: 1 as const };
const records: SelfStudyAttendanceRecord[] = [
  { id: "a", ...base, studentId: "s1", status: "PRESENT" },
  { id: "b", ...base, studentId: "s1", status: "EXCUSED_ABSENCE", permissionId: "p", permissionReasonCode: "MEDICAL", permissionReasonText: "Clinic" },
  { id: "c", ...base, studentId: "s2", status: "UNEXCUSED_ABSENCE" },
];

describe("self-study reporting", () => {
  it("keeps present, excused, and unexcused counts distinct", () => {
    expect(summarizeSelfStudyAttendance(records)).toEqual({ total: 3, present: 1, excused: 1, unexcused: 1 });
    expect(summarizeSelfStudyAttendanceBy(records, (record) => record.studentId).get("s1")).toEqual({ total: 2, present: 1, excused: 1, unexcused: 0 });
  });
  it("uses scoped exception IDs and ignores inactive exceptions in the date policy", () => {
    expect(makeSelfStudyExceptionId("2026", "school", null, "2026-09-18")).toBe("2026_school_2026-09-18");
    expect(makeSelfStudyExceptionId("2026", "grade", "g2", "2026-09-18")).toBe("2026_g2_2026-09-18");
    expect(isScopedSelfStudyDate("2026-09-18", [{ active: false }])).toBe(true);
    expect(isScopedSelfStudyDate("2026-09-18", [{ active: true }])).toBe(false);
  });
});
