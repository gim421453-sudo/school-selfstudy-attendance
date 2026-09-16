import type { AppUser, AttendanceRecord, ClassRoom, DutyAssignment, Period, Student } from "../types/domain";
import { isSelfStudyDay, SUNDAY_DUTY_MESSAGE } from "../domain/schedule";

export const EXCEL_LIMITS = {
  maxFileBytes: 8 * 1024 * 1024,
  maxSheets: 10,
  maxRows: 5_000,
  maxColumns: 50,
  maxCellTextLength: 500,
} as const;

const DUTY_HEADERS = ["date", "teacherName", "teacherEmail", "note"] as const;
const STUDENT_HEADERS = ["grade", "classNo", "studentNo", "name"] as const;

export interface DutyImportRow {
  rowNo: number;
  date: string;
  teacherName: string;
  teacherEmail: string;
  note: string;
  matchedUser?: AppUser;
  error?: string;
}

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

function localDateString(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function firstValue(row: Record<string, unknown>, keys: readonly string[]): unknown {
  return keys.map((key) => row[key]).find((value) => value !== undefined);
}

function text(value: unknown, field: string): string {
  const result = String(value ?? "").trim();
  if (result.length > EXCEL_LIMITS.maxCellTextLength) throw new Error(`${field} is too long.`);
  return result;
}

function validDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDateCell(value: unknown, XLSX: SpreadsheetModule): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return localDateString(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && validDate(parsed.y, parsed.m, parsed.d)) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const match = text(value, "Date").replaceAll(".", "-").replaceAll("/", "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match || !validDate(Number(match[1]), Number(match[2]), Number(match[3]))) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
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

export async function parseDutyWorkbook(file: File, users: AppUser[]): Promise<DutyImportRow[]> {
  const { XLSX, workbook } = await readSafeWorkbook(file);
  return parseDutyRows(XLSX, workbook, users);
}

export async function parseDutyWorkbookBuffer(buffer: ArrayBuffer, users: AppUser[]): Promise<DutyImportRow[]> {
  const { XLSX, workbook } = await readSafeWorkbookBuffer(buffer);
  return parseDutyRows(XLSX, workbook, users);
}

function parseDutyRows(XLSX: SpreadsheetModule, workbook: import("xlsx").WorkBook, users: AppUser[]): DutyImportRow[] {
  const rows = nonEmptyRows(XLSX, workbook);
  const aliases = [["\uB0A0\uC9DC", "date", "Date"], ["\uB2F4\uB2F9\uAD50\uC0AC", "teacherName"], ["\uB2F4\uB2F9\uAD50\uC0AC\uC774\uBA54\uC77C", "\uC774\uBA54\uC77C", "email", "teacherEmail"], ["\uBE44\uACE0", "note"]];
  if (!hasExpectedHeader(rows, DUTY_HEADERS, aliases)) throw new Error("The duty workbook headers do not match the required template.");
  const dates = new Map<string, number>();
  return rows.map((row, index) => {
    const date = normalizeDateCell(firstValue(row, aliases[0]), XLSX);
    const teacherName = text(firstValue(row, aliases[1]), "Teacher name");
    const teacherEmail = text(firstValue(row, aliases[2]), "Teacher email").toLowerCase();
    const note = text(firstValue(row, aliases[3]), "Note");
    let matchedUser: AppUser | undefined;
    let error = "";
    if (!date) error = "Invalid or missing date.";
    else if (!isSelfStudyDay(date)) error = SUNDAY_DUTY_MESSAGE;
    else if (!teacherEmail && !teacherName) error = "Teacher email or name is required.";
    else {
      if (teacherEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacherEmail)) error = "Invalid teacher email.";
      if (!error && teacherEmail) matchedUser = users.find((user) => user.active && user.email.toLowerCase() === teacherEmail);
      if (!matchedUser && !error && teacherName) {
        const matches = users.filter((user) => user.active && user.displayName.trim() === teacherName);
        if (matches.length === 1) matchedUser = matches[0];
        if (matches.length > 1) error = "Teacher name is ambiguous; use email.";
      }
      if (!matchedUser && !error) error = "No active teacher matches this row.";
    }
    if (date) dates.set(date, (dates.get(date) ?? 0) + 1);
    return { rowNo: index + 2, date, teacherName, teacherEmail, note, matchedUser, error: error || undefined };
  }).map((row) => dates.get(row.date)! > 1 ? { ...row, error: "Duplicate duty date in workbook." } : row);
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

export async function createDutyTemplateWorkbook(start: string, end: string) {
  const XLSX = await import("xlsx");
  const rows: Record<string, string>[] = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    if (isSelfStudyDay(cursor)) {
      rows.push({ "\uB0A0\uC9DC": localDateString(cursor), "\uB2F4\uB2F9\uAD50\uC0AC": "", "\uB2F4\uB2F9\uAD50\uC0AC\uC774\uBA54\uC77C": "", "\uBE44\uACE0": "" });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  const headers = ["\uB0A0\uC9DC", "\uB2F4\uB2F9\uAD50\uC0AC", "\uB2F4\uB2F9\uAD50\uC0AC\uC774\uBA54\uC77C", "\uBE44\uACE0"];
  const ws = sheetFromRows(XLSX, rows, headers);
  ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 30 }, { wch: 24 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Duty schedule");
  return wb;
}

export async function downloadDutyTemplate(start: string, end: string) {
  const XLSX = await import("xlsx");
  const wb = await createDutyTemplateWorkbook(start, end);
  XLSX.writeFile(wb, `duty_schedule_${start}_${end}.xlsx`);
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

export async function exportAttendanceExcel(input: { records: AttendanceRecord[]; students: Student[]; periods: Period[]; filename: string }) {
  const XLSX = await import("xlsx");
  const wb = await createAttendanceWorkbook(input);
  XLSX.writeFile(wb, input.filename);
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

export function dutyRowsToAssignments(rows: DutyImportRow[], actorUid: string): Array<{ date: string; teacherUid: string; teacherName: string; teacherEmail: string; note: string; source: "excel"; updatedBy: string }> {
  if (rows.some((row) => row.date && !isSelfStudyDay(row.date))) throw new Error(SUNDAY_DUTY_MESSAGE);
  return rows.filter((row) => row.matchedUser && !row.error).map((row) => ({ date: row.date, teacherUid: row.matchedUser!.uid, teacherName: row.matchedUser!.displayName, teacherEmail: row.matchedUser!.email, note: row.note, source: "excel", updatedBy: actorUid }));
}

export async function parseDutyWorkbookByPeriod(file: File, users: AppUser[], periods: Period[]): Promise<DutyPeriodImportRow[]> {
  const { XLSX, workbook } = await readSafeWorkbook(file);
  const rows = nonEmptyRows(XLSX, workbook);
  const headers = Object.keys(rows[0] ?? {});
  if (!headers.includes("date") && !headers.includes("\uB0A0\uC9DC")) throw new Error("The duty workbook must include a date column.");
  const activePeriods = periods.filter((period) => period.active);
  const result: DutyPeriodImportRow[] = [];
  for (const [index, row] of rows.entries()) {
    const date = normalizeDateCell(row.date ?? row["\uB0A0\uC9DC"], XLSX);
    for (const period of activePeriods) {
      const value = text(row[period.name] ?? row[period.id], period.name);
      if (!value) continue;
      const teacherEmail = value.includes("@") ? value.toLowerCase() : "";
      const teacherName = teacherEmail ? "" : value;
      const matchedUser = teacherEmail ? users.find((user) => user.active && user.email.toLowerCase() === teacherEmail) : users.filter((user) => user.active && user.displayName.trim() === teacherName).length === 1 ? users.find((user) => user.active && user.displayName.trim() === teacherName) : undefined;
      let error = "";
      if (!date) error = "Invalid or missing date.";
      else if (!isSelfStudyDay(date)) error = SUNDAY_DUTY_MESSAGE;
      else if (!matchedUser) error = "No active teacher matches this period assignment.";
      result.push({ rowNo: index + 2, date, periodId: period.id, periodName: period.name, teacherName, teacherEmail, matchedUser, error: error || undefined });
    }
  }
  return result;
}

export function dutyPeriodRowsToAssignments(rows: DutyPeriodImportRow[]): Array<{ date: string; periodId: string; teacherUid: string; teacherName: string; teacherEmail: string; source: "excel" }> {
  if (rows.some((row) => row.error)) throw new Error("Resolve all duty import errors before applying.");
  return rows.map((row) => ({ date: row.date, periodId: row.periodId, teacherUid: row.matchedUser!.uid, teacherName: row.matchedUser!.displayName, teacherEmail: row.matchedUser!.email, source: "excel" }));
}
