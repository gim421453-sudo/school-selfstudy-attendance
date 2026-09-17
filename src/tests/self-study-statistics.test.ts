import { describe, expect, it } from "vitest";
import { selfStudyAttendanceCoverage } from "../domain/selfStudyStatistics";

describe("self-study attendance coverage", () => {
  it("counts operating slots without treating missing input as unexcused absence", () => {
    const scope = { academicYearId: "2026", gradeId: "g1" };
    const result = selfStudyAttendanceCoverage({ startDate: "2026-09-20", endDate: "2026-09-20", memberships: [{ id: "m", ...scope, studentId: "s1", classId: "c1", selfStudyGroupId: "group", active: true }], edges: [{ id: "e", ...scope, groupId: "group", periodId: "p1", active: true }], periods: [{ id: "p1", ...scope, name: "Sunday", order: 1, startTime: "18:00", endTime: "18:50", active: true, operatingDays: [0] }], exceptions: [], records: [] });
    expect(result).toEqual({ expected: 1, missing: 1 });
  });
});
