import { describe, expect, it } from "vitest";
import { isSelfStudyDate, isSelfStudyDay, SUNDAY_DUTY_MESSAGE } from "../domain/schedule";
import { validateAttendanceWriteDate } from "../services/attendance";
import { validateDutyAssignmentDate } from "../services/duty";

describe("self-study operating days", () => {
  it("allows Monday through Saturday and excludes Sunday", () => {
    expect(isSelfStudyDay("2026-09-14")).toBe(true);
    expect(isSelfStudyDay("2026-09-19")).toBe(true);
    expect(isSelfStudyDay("2026-09-20")).toBe(false);
  });

  it("excludes enabled holiday and exam exceptions", () => {
    expect(isSelfStudyDate("2026-09-14", { enabled: true })).toBe(false);
    expect(isSelfStudyDate("2026-09-15", { enabled: true })).toBe(false);
    expect(isSelfStudyDate("2026-09-16", { enabled: false })).toBe(true);
  });

  it("rejects Sunday duty assignment writes", async () => {
    await expect(validateDutyAssignmentDate("2026-09-20")).rejects.toThrow(SUNDAY_DUTY_MESSAGE);
  });

  it("rejects Sunday attendance writes while keeping Monday through Saturday available", async () => {
    await expect(validateAttendanceWriteDate("2026-09-20")).rejects.toThrow(/\uC77C\uC694\uC77C/);
  });
});
