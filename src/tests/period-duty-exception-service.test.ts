import { describe, expect, it } from "vitest";
import { makeDutyAssignmentId } from "../domain/ids";
import { isScopedSelfStudyDate } from "../domain/schedule";
import { auditEventData } from "../services/audit";
import { buildScopedDutyImportPreview } from "../services/scopedDuty";
import { validateScopedPeriod, type ScopedPeriod } from "../services/scopedPeriods";
import type { DutyPeriodImportRow } from "../lib/excel";
import type { AppUser } from "../types/domain";

const periods: ScopedPeriod[] = [
  { id: "p-2-1", academicYearId: "2026", gradeId: "2026-2", name: "자습 1교시", order: 1, startTime: "18:00", endTime: "18:50", active: true },
  { id: "p-2-2", academicYearId: "2026", gradeId: "2026-2", name: "자습 2교시", order: 2, startTime: "19:00", endTime: "19:50", active: true },
];
const teacher: AppUser = { uid: "teacher-2", email: "teacher@example.com", displayName: "Teacher", active: true, roles: ["teacher"], globalRoles: ["teacher"] };
const otherTeacher: AppUser = { uid: "teacher-1", email: "other@example.com", displayName: "Other", active: true, roles: ["teacher"], globalRoles: ["teacher"] };

describe("scoped period, duty, and exception contracts", () => {
  it("rejects duplicate order in one grade but permits the same order in another grade", () => {
    expect(() => validateScopedPeriod({ ...periods[0], id: "new" }, periods)).toThrow(/scope/);
    expect(() => validateScopedPeriod({ ...periods[0], id: "p-1-1", gradeId: "2026-1" }, [])).not.toThrow();
    expect(() => validateScopedPeriod({ ...periods[0], startTime: "19:00", endTime: "18:00" }, [])).toThrow();
  });

  it("uses a grade-scoped duty document and separate per-period assignments", () => {
    expect(makeDutyAssignmentId("2026-2", "2026-09-16")).toBe("2026-2_2026-09-16");
    expect(periods.map((period) => period.id)).toEqual(["p-2-1", "p-2-2"]);
  });

  it("limits Excel matching to eligible teachers and active periods in the selected grade", () => {
    const rows: DutyPeriodImportRow[] = [
      { rowNo: 2, date: "2026-09-16", periodId: "p-2-1", periodName: "자습 1교시", teacherName: "Teacher", teacherEmail: "", matchedUser: teacher },
      { rowNo: 2, date: "2026-09-16", periodId: "foreign", periodName: "자습 3교시", teacherName: "Other", teacherEmail: "", matchedUser: otherTeacher },
    ];
    const preview = buildScopedDutyImportPreview({ academicYearId: "2026", gradeId: "2026-2" }, rows, periods, [{ user: teacher }]);
    expect(preview.rows[0].error).toBeUndefined();
    expect(preview.rows[1].error).toMatch(/Period/);
  });

  it("applies Sunday, school-wide, grade-only, and inactive exception rules centrally", () => {
    expect(isScopedSelfStudyDate("2026-09-20", [])).toBe(false);
    expect(isScopedSelfStudyDate("2026-09-16", [{ active: true }])).toBe(false);
    expect(isScopedSelfStudyDate("2026-09-16", [{ active: false }])).toBe(true);
    expect(isScopedSelfStudyDate("2026-09-16", [])).toBe(true);
  });

  it("adds duty audit metadata", () => {
    const data = auditEventData({ actor: { uid: "owner", name: "Owner" }, action: "DUTY_PERIOD_ASSIGNED", targetType: "duty_assignment", targetId: "2026-2_2026-09-16/p-2-1", academicYearId: "2026", gradeId: "2026-2", periodId: "p-2-1", dutyDate: "2026-09-16" });
    expect(data).toMatchObject({ academicYearId: "2026", gradeId: "2026-2", periodId: "p-2-1", dutyDate: "2026-09-16" });
  });
});
