import { describe, expect, it } from "vitest";
import { buildGradeDashboardDiagnostics } from "../domain/dashboardDiagnostics";

const scope = { academicYearId: "2026", gradeId: "g1" };
describe("dashboard diagnostics", () => {
  it("keeps grade diagnostics isolated and separates missing input from unexcused absence", () => {
    const result = buildGradeDashboardDiagnostics({ date: "2026-09-21", operationalDay: true,
      students: [{ id: "s1", ...scope, classId: "c1", studentNo: 1, name: "A", active: true }, { id: "s2", ...scope, classId: "c1", studentNo: 2, name: "B", active: true }],
      classes: [{ id: "c1", ...scope, classNumber: 1, displayName: "1", active: true }], groups: [{ id: "group", ...scope, displayName: "G", type: "REGULAR", active: true, sortOrder: 1 }],
      memberships: [{ id: "m1", ...scope, studentId: "s1", classId: "c1", selfStudyGroupId: "group", active: true }], edges: [{ id: "edge", ...scope, groupId: "group", periodId: "p1", active: true }],
      assignments: [{ id: "a", ...scope, uid: "u", role: "teacher", active: true }], supervision: [], exceptions: [],
      attendance: [{ id: "r", ...scope, date: "2026-09-21", periodId: "p1", studentId: "s1", classId: "c1", selfStudyGroupId: "group", status: "UNEXCUSED_ABSENCE", recordedByUid: "u", updatedByUid: "u", schemaVersion: 1 }],
    });
    expect(result).toMatchObject({ studentCount: 2, unassignedStudentCount: 1, missingGradeAdmin: true, missingHomeroomCount: 1, missingSupervisionCount: 1, unexcusedCount: 1, missingAttendanceCount: 0 });
  });
  it("excludes one selected period without affecting another", () => {
    const common = { date: "2026-09-21", operationalDay: true, students: [], classes: [], groups: [{ id: "g", ...scope, displayName: "G", type: "REGULAR" as const, active: true, sortOrder: 1 }], memberships: [], assignments: [], supervision: [], attendance: [], exceptions: [{ ...scope, scopeType: "grade" as const, date: "2026-09-21", reasonType: "exam" as const, reason: "x", active: true, periodIds: ["p1"] }] };
    expect(buildGradeDashboardDiagnostics({ ...common, edges: [{ id: "p1", ...scope, groupId: "g", periodId: "p1", active: true }, { id: "p2", ...scope, groupId: "g", periodId: "p2", active: true }] }).missingSupervisionCount).toBe(1);
  });
});
