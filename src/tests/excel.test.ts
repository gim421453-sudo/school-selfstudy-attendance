import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  EXCEL_LIMITS,
  parseStudentWorkbookBuffer,
  readSafeWorkbook,
  readSafeWorkbookBuffer,
} from "../lib/excel";
import type { ClassRoom, Student } from "../types/domain";

const classes: ClassRoom[] = [{ id: "2-1", grade: 2, classNo: 1, displayName: "2-1", active: true }];
const existing: Student[] = [{ id: "s1", classId: "2-1", studentNo: 1, name: "Existing", active: true }];

function workbook(rows: Record<string, unknown>[], ref?: string): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (ref) ws["!ref"] = ref;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

function file(rows: Record<string, unknown>[], name = "upload.xlsx"): File {
  return new File([workbook(rows)], name, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const row = { date: "2026-09-15", teacherName: "Teacher One", teacherEmail: "teacher@example.com", note: "" };

describe("safe workbook reading", () => {
  it("rejects a workbook with too many rows", async () => {
    await expect(readSafeWorkbookBuffer(workbook([row], `A1:D${EXCEL_LIMITS.maxRows + 2}`))).rejects.toThrow(/row limit/);
  });
  it("rejects a workbook with too many columns", async () => {
    await expect(readSafeWorkbookBuffer(workbook([row], "A1:AZ2"))).rejects.toThrow(/column limit/);
  });
  it("rejects a non-xlsx payload", async () => {
    await expect(readSafeWorkbook(new File(["not a zip"], "upload.xlsx"))).rejects.toThrow(/not an XLSX/);
  });
  it("rejects an unapproved extension", async () => {
    await expect(readSafeWorkbook(file([row], "upload.xls"))).rejects.toThrow(/Only .xlsx/);
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
