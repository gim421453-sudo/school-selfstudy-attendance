import { describe, expect, it } from "vitest";
import { shiftSupervisionCalendarMonth, SUPERVISION_CALENDAR_WEEKDAYS, supervisionCalendarCells } from "../domain/supervisionCalendar";

describe("supervision monthly calendar", () => {
  it("provides the seven Sunday-to-Saturday weekday headers", () => {
    expect(SUPERVISION_CALENDAR_WEEKDAYS).toEqual(["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"]);
  });

  it("keeps leading blanks for a Sunday-start month and produces date strings without UTC conversion", () => {
    const cells = supervisionCalendarCells("2026-11");
    expect(cells[0]).toEqual({ date: "2026-11-01", day: 1 });
    expect(cells.at(-1)).toEqual({ date: null, day: null });
  });

  it("handles 28, 29, 30, and 31 day months", () => {
    expect(supervisionCalendarCells("2026-02").filter((cell) => cell.date).at(-1)?.date).toBe("2026-02-28");
    expect(supervisionCalendarCells("2028-02").filter((cell) => cell.date).at(-1)?.date).toBe("2028-02-29");
    expect(supervisionCalendarCells("2026-09").filter((cell) => cell.date).at(-1)?.date).toBe("2026-09-30");
    expect(supervisionCalendarCells("2026-10").filter((cell) => cell.date).at(-1)?.date).toBe("2026-10-31");
  });

  it("always builds five or six complete Sunday-to-Saturday weeks", () => {
    for (const month of ["2026-02", "2026-08", "2026-11"]) expect(supervisionCalendarCells(month).length).toBeGreaterThanOrEqual(35);
    expect(supervisionCalendarCells("2026-08").length % 7).toBe(0);
  });

  it("moves between months without constructing invalid dates", () => {
    expect(shiftSupervisionCalendarMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftSupervisionCalendarMonth("2026-12", 1)).toBe("2027-01");
  });
});
