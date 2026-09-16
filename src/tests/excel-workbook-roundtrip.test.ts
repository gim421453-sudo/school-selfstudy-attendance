import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { createAttendanceWorkbook, createDutyTemplateWorkbook, createStatsWorkbook } from "../lib/excel";

function roundTrip(workbook: XLSX.WorkBook): XLSX.WorkBook {
  return XLSX.read(XLSX.write(workbook, { type: "array", bookType: "xlsx" }), { type: "array", raw: true });
}

function values(workbook: XLSX.WorkBook, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: "" });
}

describe("Excel workbook round trips", () => {
  it("round-trips populated attendance history with headers, Korean text, and safe cells", async () => {
    const workbook = await createAttendanceWorkbook({
      records: [{ date: "2026-09-16", classId: "2-1", studentId: "student-1", periodId: "period-1", status: "present", note: " =SUM(A1)", markedBy: "teacher-1", markedAt: null, updatedAt: null }],
      students: [{ id: "student-1", studentNo: 7, name: "\uAE40\uBBFC\uC900", classId: "2-1", active: true }],
      periods: [{ id: "period-1", name: "\uC790\uC728\uD559\uC2B5", order: 1, startTime: "18:00", endTime: "19:00", active: true }],
    });
    const result = roundTrip(workbook);
    expect(result.SheetNames).toEqual(["Attendance"]);
    expect(values(result, "Attendance")).toEqual([["date", "class", "studentNo", "name", "period", "status", "note"], ["2026-09-16", "2-1", 7, "\uAE40\uBBFC\uC900", "\uC790\uC728\uD559\uC2B5", "present", "' =SUM(A1)"]]);
    expect(result.Sheets.Attendance.G2?.f).toBeUndefined();
  });

  it("keeps attendance headers when history has no records", async () => {
    const result = roundTrip(await createAttendanceWorkbook({ records: [], students: [], periods: [] }));
    expect(values(result, "Attendance")).toEqual([["date", "class", "studentNo", "name", "period", "status", "note"]]);
  });

  it("round-trips student statistics and neutralizes every formula-like value", async () => {
    const headers = ["\uD559\uC0DD", "\uAC12"];
    const unsafe = ["=SUM(A1)", "+cmd", "@name", "-hello", " =SUM(A1)", "\t=SUM(A1)", "\n=SUM(A1)"];
    const result = roundTrip(await createStatsWorkbook(unsafe.map((value, index) => ({ "\uD559\uC0DD": `\uD559\uC0DD ${index + 1}`, "\uAC12": value })), headers));
    const rows = values(result, "Statistics");
    expect(result.SheetNames).toEqual(["Statistics"]);
    expect(rows[0]).toEqual(headers);
    expect(rows.slice(1).map((row) => row[1])).toEqual(unsafe.map((value) => `'${value}`));
    expect(Object.values(result.Sheets.Statistics).filter((cell): cell is XLSX.CellObject => typeof cell === "object" && cell !== null && "f" in cell).map((cell) => cell.f)).toEqual([]);
  });

  it("round-trips class statistics without changing Korean text or negative numbers", async () => {
    const result = roundTrip(await createStatsWorkbook([{ "\uD559\uAE09": "2\uD559\uB144 1\uBC18", "\uCC38\uC5EC \uC218": -123 }, { "\uD559\uAE09": "2\uD559\uB144 2\uBC18", "\uCC38\uC5EC \uC218": -12.5 }]));
    expect(values(result, "Statistics")).toEqual([["\uD559\uAE09", "\uCC38\uC5EC \uC218"], ["2\uD559\uB144 1\uBC18", -123], ["2\uD559\uB144 2\uBC18", -12.5]]);
  });

  it("round-trips period statistics with their original headers", async () => {
    const result = roundTrip(await createStatsWorkbook([{ "\uAD50\uC2DC": "1\uAD50\uC2DC", "\uCD9C\uC11D\uB960": 95.5 }, { "\uAD50\uC2DC": "2\uAD50\uC2DC", "\uCD9C\uC11D\uB960": 100 }]));
    expect(values(result, "Statistics")).toEqual([["\uAD50\uC2DC", "\uCD9C\uC11D\uB960"], ["1\uAD50\uC2DC", 95.5], ["2\uAD50\uC2DC", 100]]);
  });

  it("round-trips the duty schedule template with date rows and headers", async () => {
    const result = roundTrip(await createDutyTemplateWorkbook("2026-09-16", "2026-09-17"));
    expect(result.SheetNames).toEqual(["Duty schedule"]);
    expect(values(result, "Duty schedule")).toEqual([["\uB0A0\uC9DC", "\uB2F4\uB2F9\uAD50\uC0AC", "\uB2F4\uB2F9\uAD50\uC0AC\uC774\uBA54\uC77C", "\uBE44\uACE0"], ["2026-09-16", "", "", ""], ["2026-09-17", "", "", ""]]);
  });
});
