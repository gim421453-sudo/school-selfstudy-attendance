import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  EXCEL_LIMITS,
  parseDutyWorkbook,
  parseDutyWorkbookByPeriod,
  parseDutyWorkbookBuffer,
  parseStudentWorkbookBuffer,
  readSafeWorkbook,
} from "../lib/excel";
import type { AppUser, ClassRoom, Student } from "../types/domain";

const teacher: AppUser = { uid: "t1", email: "teacher@example.com", displayName: "Teacher One", roles: ["teacher"], active: true };
const duplicateName: AppUser = { uid: "t2", email: "other@example.com", displayName: "Teacher One", roles: ["teacher"], active: true };
const classes: ClassRoom[] = [{ id: "2-1", grade: 2, classNo: 1, displayName: "2-1", active: true }];
const existing: Student[] = [{ id: "s1", classId: "2-1", studentNo: 1, name: "Existing", active: true }];

function workbook(rows: Record<string, unknown>[], ref?: string): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (ref) ws["!ref"] = ref;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function file(rows: Record<string, unknown>[], name = "duty.xlsx"): File {
  return new File([workbook(rows)], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const dutyRow = { date: "2026-09-15", teacherName: "Teacher One", teacherEmail: "teacher@example.com", note: "" };

describe("safe duty workbook parsing", () => {
  it("parses a valid workbook", async () => {
    await expect(parseDutyWorkbookBuffer(workbook([dutyRow]), [teacher])).resolves.toMatchObject([{ date: "2026-09-15", matchedUser: teacher }]);
  });
  it("matches a teacher by email", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, teacherName: "" }]), [teacher]);
    expect(rows[0].matchedUser?.uid).toBe("t1");
  });
  it("falls back to an unambiguous name", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, teacherEmail: "" }]), [teacher]);
    expect(rows[0].matchedUser?.uid).toBe("t1");
  });
  it("reports an unknown teacher", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, teacherName: "", teacherEmail: "missing@example.com" }]), [teacher]);
    expect(rows[0].error).toMatch(/No active teacher/);
  });
  it("reports an ambiguous name", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, teacherEmail: "" }]), [teacher, duplicateName]);
    expect(rows[0].error).toMatch(/ambiguous/);
  });
  it("reports missing teacher cells", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, teacherName: "", teacherEmail: "" }]), [teacher]);
    expect(rows[0].error).toMatch(/required/);
  });
  it("ignores empty data rows", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([dutyRow, { date: "", teacherName: "", teacherEmail: "", note: "" }]), [teacher]);
    expect(rows).toHaveLength(1);
  });
  it("reports an invalid date", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, date: "2026-02-30" }]), [teacher]);
    expect(rows[0].error).toMatch(/Invalid/);
  });
  it("reports Sunday rows instead of silently applying them", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([{ ...dutyRow, date: "2026-09-20" }]), [teacher]);
    expect(rows[0].error).toMatch(/\uC77C\uC694\uC77C/);
  });
  it("parses dynamic period columns without hard-coding the period count", async () => {
    const periods = [
      { id: "p1", name: "Period One", order: 1, startTime: "18:00", endTime: "18:30", active: true },
      { id: "p2", name: "Period Two", order: 2, startTime: "18:30", endTime: "19:00", active: true },
      { id: "p4", name: "Period Four", order: 4, startTime: "19:00", endTime: "19:30", active: true },
    ];
    const rows = await parseDutyWorkbookByPeriod(file([{ date: "2026-09-15", "Period One": "teacher@example.com", "Period Two": "Teacher One", "Period Four": "teacher@example.com" }]), [teacher], periods);
    expect(rows.map((row) => row.periodId)).toEqual(["p1", "p2", "p4"]);
    expect(rows.every((row) => !row.error)).toBe(true);
  });
  it("accepts a Sunday assignment only when its scoped period operates on Sunday", async () => {
    const periods = [{ id: "p1", name: "Sunday period", order: 1, startTime: "18:00", endTime: "18:30", active: true, operatingDays: [0] }];
    const rows = await parseDutyWorkbookByPeriod(file([{ date: "2026-09-20", "Sunday period": "teacher@example.com" }]), [teacher], periods);
    expect(rows[0].error).toBeUndefined();
  });
  it("reports duplicate dates", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([dutyRow, dutyRow]), [teacher]);
    expect(rows.every((row) => row.error?.includes("Duplicate"))).toBe(true);
  });
  it("rejects incorrect headers", async () => {
    await expect(parseDutyWorkbookBuffer(workbook([{ when: "2026-09-15" }]), [teacher])).rejects.toThrow(/headers/);
  });
  it("rejects an empty worksheet", async () => {
    await expect(parseDutyWorkbookBuffer(workbook([{ date: "", teacherName: "", teacherEmail: "", note: "" }]), [teacher])).rejects.toThrow(/headers|no data rows/);
  });
  it("rejects a workbook with too many rows", async () => {
    await expect(parseDutyWorkbookBuffer(workbook([dutyRow], `A1:D${EXCEL_LIMITS.maxRows + 2}`), [teacher])).rejects.toThrow(/row limit/);
  });
  it("rejects a workbook with too many columns", async () => {
    await expect(parseDutyWorkbookBuffer(workbook([dutyRow], "A1:AZ2"), [teacher])).rejects.toThrow(/column limit/);
  });
  it("rejects a non-xlsx payload", async () => {
    await expect(readSafeWorkbook(new File(["not a zip"], "duty.xlsx"))).rejects.toThrow(/not an XLSX/);
  });
  it("rejects an unapproved extension", async () => {
    await expect(readSafeWorkbook(file([dutyRow], "duty.xls"))).rejects.toThrow(/Only .xlsx/);
  });
  it("does not write while parsing mixed-validity rows", async () => {
    const rows = await parseDutyWorkbookBuffer(workbook([dutyRow, { ...dutyRow, date: "bad-date" }]), [teacher]);
    expect(rows.map((row) => row.error)).toEqual([undefined, "Invalid or missing date."]);
  });
});

describe("student roster preview", () => {
  const studentRow = { grade: 2, classNo: 1, studentNo: 2, name: "New student" };
  it("classifies a new student", async () => {
    const result = await parseStudentWorkbookBuffer(workbook([studentRow]), classes, existing);
    expect(result.newCount).toBe(1);
  });
  it("classifies an unchanged student", async () => {
    const result = await parseStudentWorkbookBuffer(workbook([{ ...studentRow, studentNo: 1, name: "Existing" }]), classes, existing);
    expect(result.unchangedCount).toBe(1);
  });
  it("classifies a changed student as an update", async () => {
    const result = await parseStudentWorkbookBuffer(workbook([{ ...studentRow, studentNo: 1, name: "Renamed" }]), classes, existing);
    expect(result.updateCount).toBe(1);
  });
  it("reports duplicate locations as a conflict", async () => {
    const result = await parseStudentWorkbookBuffer(workbook([studentRow, studentRow]), classes, existing);
    expect(result.conflictCount).toBe(2);
  });
  it("reports invalid roster data", async () => {
    const result = await parseStudentWorkbookBuffer(workbook([{ ...studentRow, studentNo: 0 }]), classes, existing);
    expect(result.errorCount).toBe(1);
  });
});
