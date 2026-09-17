import { describe, expect, it } from "vitest";
import { makeDutyAssignmentId } from "../domain/ids";
import { isPeriodOperatingOn, isScopedSelfStudyDate, periodScheduleForDate } from "../domain/schedule";
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
    expect(() => validateScopedPeriod({ ...periods[0], id: "new" }, periods)).toThrow(/같은 요일/);
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

  it("applies school-wide, grade-only, and inactive exception rules centrally", () => {
    expect(isScopedSelfStudyDate("2026-09-20", [])).toBe(true);
    expect(isScopedSelfStudyDate("2026-09-16", [{ active: true }])).toBe(false);
    expect(isScopedSelfStudyDate("2026-09-16", [{ active: false }])).toBe(true);
    expect(isScopedSelfStudyDate("2026-09-16", [])).toBe(true);
  });

  it("uses each grade period's operating days, including an explicitly configured Sunday", () => {
    expect(isPeriodOperatingOn("2026-09-20", { operatingDays: [0] })).toBe(true);
    expect(isPeriodOperatingOn("2026-09-20", { operatingDays: [1, 2, 3, 4, 5, 6] })).toBe(false);
    expect(isPeriodOperatingOn("2026-09-19", {})).toBe(true);
  });

  it("uses a canonical per-day schedule while legacy period times remain readable", () => {
    const period = { operatingDays: [1, 2], startTime: "18:00", endTime: "18:50", scheduleByDay: { "0": { enabled: true, startTime: "09:00", endTime: "12:00" }, "1": { enabled: true, startTime: "18:20", endTime: "19:10" } } };
    expect(isPeriodOperatingOn("2026-09-20", period)).toBe(true);
    expect(periodScheduleForDate(period, "2026-09-20")).toMatchObject({ enabled: true, startTime: "09:00", endTime: "12:00" });
    expect(periodScheduleForDate({ operatingDays: [6], startTime: "10:00", endTime: "11:00" }, "2026-09-19")).toMatchObject({ enabled: true, startTime: "10:00", endTime: "11:00" });
  });

  it("keeps weekday block names, times, and enabled state independent", () => {
    const period = {
      name: "1자습", order: 1, periodType: "SELF_STUDY" as const, operatingDays: [1, 2], startTime: "18:00", endTime: "18:50",
      scheduleByDay: {
        "1": { enabled: true, name: "야간 1자습", order: 2, periodType: "SELF_STUDY" as const, startTime: "19:00", endTime: "19:50" },
      },
    };
    expect(periodScheduleForDate(period, "2026-09-21")).toMatchObject({ name: "야간 1자습", order: 2, startTime: "19:00", endTime: "19:50" });
    expect(periodScheduleForDate(period, "2026-09-22")).toMatchObject({ name: "1자습", order: 1, startTime: "18:00", endTime: "18:50" });
    expect(isPeriodOperatingOn("2026-09-22", { ...period, scheduleByDay: { ...period.scheduleByDay, "1": { ...period.scheduleByDay["1"], enabled: false } } })).toBe(true);
  });

  it("keeps newly added and disabled weekday blocks out of other days until explicitly copied", () => {
    const saturdayOnly = {
      name: "토요 자습", order: 1, periodType: "SELF_STUDY" as const, operatingDays: [6], startTime: "09:00", endTime: "09:50",
      scheduleByDay: { "1": { enabled: false, startTime: "09:00", endTime: "09:50" }, "2": { enabled: false, startTime: "09:00", endTime: "09:50" }, "6": { enabled: true, name: "토요 1자습", order: 1, periodType: "SELF_STUDY" as const, startTime: "09:00", endTime: "09:50" } },
    };
    expect(isPeriodOperatingOn("2026-09-19", saturdayOnly)).toBe(true);
    expect(isPeriodOperatingOn("2026-09-21", saturdayOnly)).toBe(false);
    const copied = { ...saturdayOnly, scheduleByDay: { ...saturdayOnly.scheduleByDay, "1": { ...saturdayOnly.scheduleByDay["6"] } } };
    expect(isPeriodOperatingOn("2026-09-21", copied)).toBe(true);
  });

  it("supports an independent Saturday timetable with five self-study blocks and a break", () => {
    const saturday = Array.from({ length: 6 }, (_, index) => ({
      name: index === 2 ? "점심시간" : `${index + 1}자습`, order: index + 1, periodType: index === 2 ? "BREAK" as const : "SELF_STUDY" as const,
      operatingDays: [6], startTime: `0${9 + index}:00`, endTime: `0${9 + index}:50`,
      scheduleByDay: { "6": { enabled: true, name: index === 2 ? "점심시간" : `${index + 1}자습`, order: index + 1, periodType: index === 2 ? "BREAK" as const : "SELF_STUDY" as const, startTime: `0${9 + index}:00`, endTime: `0${9 + index}:50` } },
    }));
    expect(saturday.filter((period) => isPeriodOperatingOn("2026-09-19", period))).toHaveLength(5);
    expect(saturday.map((period) => periodScheduleForDate(period, "2026-09-19").name)).toEqual(["1자습", "2자습", "점심시간", "4자습", "5자습", "6자습"]);
  });

  it("keeps legacy periods as self-study and excludes break periods from operating slots", () => {
    expect(isPeriodOperatingOn("2026-09-21", { operatingDays: [1] })).toBe(true);
    expect(isPeriodOperatingOn("2026-09-21", { periodType: "BREAK", operatingDays: [1] })).toBe(false);
  });

  it("rejects overlapping times on the same operating day", () => {
    expect(() => validateScopedPeriod({ id: "overlap", academicYearId: "2026", gradeId: "2026-2", name: "점심시간", order: 3, startTime: "18:30", endTime: "19:10", active: true, periodType: "BREAK", operatingDays: [1], scheduleByDay: { "1": { enabled: true, startTime: "18:30", endTime: "19:10" } } }, periods)).toThrow(/겹칩니다/);
  });

  it("adds duty audit metadata", () => {
    const data = auditEventData({ actor: { uid: "owner", name: "Owner" }, action: "DUTY_PERIOD_ASSIGNED", targetType: "duty_assignment", targetId: "2026-2_2026-09-16/p-2-1", academicYearId: "2026", gradeId: "2026-2", periodId: "p-2-1", dutyDate: "2026-09-16" });
    expect(data).toMatchObject({ academicYearId: "2026", gradeId: "2026-2", periodId: "p-2-1", dutyDate: "2026-09-16" });
  });
});
