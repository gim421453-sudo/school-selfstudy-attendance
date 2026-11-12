import type { AppUser, AttendanceRecord, ClassRoom, Period, Student } from "../types/domain";

export const EXCEL_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxSheets: 10,
  maxRows: 5_000,
  maxColumns: 50,
  maxCellTextLength: 500,
} as const;

const STUDENT_HEADERS = ["grade", "classNo", "studentNo", "name"] as const;

export interface DutyPeriodImportRow {
  rowNo: number;
  date: string;
  periodId: string;
  periodName: string;
  teacherName: string;
  teacherEmail: string;
  matchedUser?: AppUser;
  error?: string;
}

export interface StudentImportRow {
  rowNo: number;
  classId: string;
  studentNo: number;
  name: string;
  existingStudent?: Student;
  change: "new" | "update" | "unchanged" | "conflict" | "error";
  error?: string;
}

export interface StudentImportSummary {
  rows: StudentImportRow[];
  newCount: number;
  updateCount: number;
  unchangedCount: number;
  conflictCount: number;
  errorCount: number;
}

type SpreadsheetModule = typeof import("xlsx");

export function escapeExcelText(value: string): string {
  const trimmed = value.replace(/^[\s]+/, "");
  if (/^[=+@]/.test(trimmed)) return `'${value}`;
  if (trimmed.startsWith("-") && !/^-\d+(\.\d+)?$/.test(trimmed)) return `'${value}`;
  return value;
}

function safeCell(value: string | number): string | number {
  return typeof value === "string" ? escapeExcelText(value) : value;
}

function sheetFromRows(
  XLSX: SpreadsheetModule,
  rows: Record<string, string | number>[],
  headers: readonly string[],
) {
  return XLSX.utils.json_to_sheet(rows, { header: [...headers] });
}

function firstValue(row: Record<string, unknown>, keys: readonly string[]): unknown {
  return keys.map((key) => row[key]).find((value) => value !== undefined);
}

function text(value: unknown, field: string): string {
  const result = String(value ?? "").trim();
  if (result.length > EXCEL_LIMITS.maxCellTextLength) throw new Error(`${field} is too long.`);
  return result;
}

function isZipFile(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

export async function readSafeWorkbook(file: File): Promise<{ XLSX: SpreadsheetModule; workbook: import("xlsx").WorkBook }> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Only .xlsx files are allowed.");
  if (file.size === 0 || file.size > EXCEL_LIMITS.maxFileBytes) throw new Error("The Excel file must be between 1 byte and 8 MB.");
  return readSafeWorkbookBuffer(await file.arrayBuffer());
}

export async function readSafeWorkbookBuffer(buffer: ArrayBuffer): Promise<{ XLSX: SpreadsheetModule; workbook: import("xlsx").WorkBook }> {
  if (!isZipFile(buffer)) throw new Error("The uploaded file is not an XLSX workbook.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true, dense: false });
  if (!workbook.SheetNames.length) throw new Error("The workbook has no sheets.");
  if (workbook.SheetNames.length > EXCEL_LIMITS.maxSheets) throw new Error(`A workbook may contain at most ${EXCEL_LIMITS.maxSheets} sheets.`);
  for (const name of workbook.SheetNames) {
    const range = workbook.Sheets[name]?.["!ref"];
    if (!range) continue;
    const decoded = XLSX.utils.decode_range(range);
    if (decoded.e.r - decoded.s.r + 1 > EXCEL_LIMITS.maxRows) throw new Error(`Sheet ${name} exceeds the ${EXCEL_LIMITS.maxRows} row limit.`);
    if (decoded.e.c - decoded.s.c + 1 > EXCEL_LIMITS.maxColumns) throw new Error(`Sheet ${name} exceeds the ${EXCEL_LIMITS.maxColumns} column limit.`);
  }
  return { XLSX, workbook };
}

function nonEmptyRows(XLSX: SpreadsheetModule, workbook: import("xlsx").WorkBook): Record<string, unknown>[] {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) throw new Error("The first worksheet is empty.");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  if (!rows.length) throw new Error("The first worksheet has no data rows.");
  return rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
}

function hasExpectedHeader(rows: Record<string, unknown>[], expected: readonly string[], aliases: readonly string[][]): boolean {
  const keys = Object.keys(rows[0] ?? {});
  return expected.every((_, index) => aliases[index].some((alias) => keys.includes(alias)));
}

export async function parseStudentWorkbook(file: File, classes: ClassRoom[], existing: Student[]): Promise<StudentImportSummary> {
  const { XLSX, workbook } = await readSafeWorkbook(file);
  return parseStudentRows(XLSX, workbook, classes, existing);
}

export async function parseStudentWorkbookBuffer(buffer: ArrayBuffer, classes: ClassRoom[], existing: Student[]): Promise<StudentImportSummary> {
  const { XLSX, workbook } = await readSafeWorkbookBuffer(buffer);
  return parseStudentRows(XLSX, workbook, classes, existing);
}

function parseStudentRows(XLSX: SpreadsheetModule, workbook: import("xlsx").WorkBook, classes: ClassRoom[], existing: Student[]): StudentImportSummary {
  const rows = nonEmptyRows(XLSX, workbook);
  const aliases = [["\uD559\uB144", "grade"], ["\uBC18", "class", "classNo"], ["\uBC88\uD638", "studentNo", "number"], ["\uD559\uC0DD \uC774\uB984", "\uC774\uB984", "name"]];
  if (!hasExpectedHeader(rows, STUDENT_HEADERS, aliases)) throw new Error("The student workbook headers do not match the required template.");
  const locations = new Map<string, number>();
  const parsed = rows.map((row, index): StudentImportRow => {
    const grade = Number(text(firstValue(row, aliases[0]), "Grade"));
    const classNo = Number(text(firstValue(row, aliases[1]), "Class"));
    const studentNo = Number(text(firstValue(row, aliases[2]), "Student number"));
    const name = text(firstValue(row, aliases[3]), "Student name");
    const classId = `${grade}-${classNo}`;
    const key = `${classId}-${studentNo}`;
    locations.set(key, (locations.get(key) ?? 0) + 1);
    let error = "";
    if (!Number.isInteger(grade) || grade < 1 || grade > 6 || !Number.isInteger(classNo) || classNo < 1 || classNo > 99) error = "Invalid grade or class.";
    else if (!Number.isInteger(studentNo) || studentNo < 1 || studentNo > 99) error = "Invalid student number.";
    else if (!name || name.length > 100) error = "Student name is required and must be at most 100 characters.";
    else if (!classes.some((classRoom) => classRoom.id === classId && classRoom.active)) error = "Class does not exist or is inactive.";
    const existingStudent = existing.find((student) => student.classId === classId && student.studentNo === studentNo);
    const change = error ? "error" : !existingStudent ? "new" : existingStudent.name === name && existingStudent.active ? "unchanged" : "update";
    return { rowNo: index + 2, classId, studentNo, name, existingStudent, change, error: error || undefined };
  }).map((row): StudentImportRow => locations.get(`${row.classId}-${row.studentNo}`)! > 1 ? { ...row, change: "conflict", error: "Duplicate grade/class/student number in workbook." } : row);
  return summarizeStudentImport(parsed);
}

export function summarizeStudentImport(rows: StudentImportRow[]): StudentImportSummary {
  return {
    rows,
    newCount: rows.filter((row) => row.change === "new").length,
    updateCount: rows.filter((row) => row.change === "update").length,
    unchangedCount: rows.filter((row) => row.change === "unchanged").length,
    conflictCount: rows.filter((row) => row.change === "conflict").length,
    errorCount: rows.filter((row) => row.change === "error").length,
  };
}

export async function createAttendanceWorkbook(input: { records: AttendanceRecord[]; students: Student[]; periods: Period[] }) {
  const XLSX = await import("xlsx");
  const studentMap = new Map(input.students.map((student) => [student.id, student]));
  const periodMap = new Map(input.periods.map((period) => [period.id, period]));
  const rows = input.records.map((record) => ({ date: record.date, class: safeCell(record.classId), studentNo: studentMap.get(record.studentId)?.studentNo ?? "", name: safeCell(studentMap.get(record.studentId)?.name ?? record.studentId), period: safeCell(periodMap.get(record.periodId)?.name ?? record.periodId), status: record.status, note: safeCell(record.note) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, rows, ["date", "class", "studentNo", "name", "period", "status", "note"]), "Attendance");
  return wb;
}

export async function createStatsWorkbook(rows: Record<string, string | number>[], headers = Object.keys(rows[0] ?? {})) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const safeRows = rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safeCell(value)])));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(XLSX, safeRows, headers), "Statistics");
  return wb;
}

export async function exportStatsExcel(rows: Record<string, string | number>[], filename: string) {
  const XLSX = await import("xlsx");
  const wb = await createStatsWorkbook(rows);
  XLSX.writeFile(wb, filename);
}
