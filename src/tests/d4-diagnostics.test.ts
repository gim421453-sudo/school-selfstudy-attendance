import { describe, expect, it } from "vitest";
import { attendanceCounts, missingSupervisionSlots } from "../domain/selfStudyDiagnostics";

describe("D4 diagnostics", () => {
  it("excludes only the exception period from missing supervision", () => {
    const result = missingSupervisionSlots({ date: "2026-09-20", isOperationalDay: true, groups: [{ id: "g", academicYearId: "2026", gradeId: "g2", displayName: "G", type: "REGULAR", active: true, sortOrder: 1 }], edges: [{ id: "g_p1", academicYearId: "2026", gradeId: "g2", groupId: "g", periodId: "p1", active: true }, { id: "g_p2", academicYearId: "2026", gradeId: "g2", groupId: "g", periodId: "p2", active: true }], assignments: [], exceptions: [{ academicYearId: "2026", gradeId: "g2", scopeType: "grade", date: "2026-09-20", reasonType: "exam", reason: "x", active: true, periodIds: ["p1"] }] });
    expect(result).toEqual([{ groupId: "g", periodId: "p2" }]);
  });
  it("keeps missing attendance distinct from unexcused", () => {
    const record = { id: "r", academicYearId: "2026", gradeId: "g2", date: "2026-09-20", periodId: "p1", studentId: "s1", classId: "c", selfStudyGroupId: "g", status: "UNEXCUSED_ABSENCE" as const, recordedByUid: "u", updatedByUid: "u", schemaVersion: 1 as const };
    expect(attendanceCounts([record], ["s1", "s2"])).toMatchObject({ UNEXCUSED_ABSENCE: 1, MISSING: 1 });
  });
});
