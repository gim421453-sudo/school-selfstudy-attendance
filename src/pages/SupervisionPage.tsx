import { format } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../auth/AuthProvider";
import { dateForMonth } from "../domain/monthDate";
import { isPeriodOperatingOn, periodScheduleForDate } from "../domain/schedule";
import { shiftSupervisionCalendarMonth, SUPERVISION_CALENDAR_WEEKDAYS, supervisionCalendarCells } from "../domain/supervisionCalendar";
import { supervisionDaySummary, validateSupervisionImportRow } from "../domain/supervisionUi";
import { listScopedPeriods } from "../services/scopedPeriods";
import { listAssignmentsForGrade } from "../services/staffAssignments";
import { deactivateSupervisionAssignment, listSelfStudyGroupPeriods, listSelfStudyGroups, listSupervisionAssignments, saveSupervisionAssignment, saveSupervisionAssignments } from "../services/selfStudyOperations";
import { useScope } from "../scope/ScopeProvider";

type AssignmentCell = { period: any; group: any };
type ImportPreview = { index: number; date: string; period?: any; group?: any; teacher?: any; status: "\uC2E0\uADDC" | "\uBCC0\uACBD \uC5C6\uC74C" | "\uC911\uBCF5" | "\uC624\uB958"; reason: string | null };

const today = () => format(new Date(), "yyyy-MM-dd");

export function SupervisionPage() {
  const { appUser } = useAuth();
  const { scope } = useScope();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [date, setDate] = useState(today());
  const [view, setView] = useState<"matrix" | "calendar">("matrix");
  const [groups, setGroups] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [periods, setPeriods] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [dayAssignments, setDayAssignments] = useState<any[]>([]);
  const [monthAssignments, setMonthAssignments] = useState<any[]>([]);
  const [selectedCell, setSelectedCell] = useState<AssignmentCell | null>(null);
  const [selectedTeacherUid, setSelectedTeacherUid] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPeriodId, setManualPeriodId] = useState("");
  const [manualGroupId, setManualGroupId] = useState("");
  const [manualTeacherUid, setManualTeacherUid] = useState("");
  const [preview, setPreview] = useState<ImportPreview[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [error, setError] = useState("");
  const uploadInput = useRef<HTMLInputElement>(null);
  const current = scope?.gradeId ? { academicYearId: scope.academicYearId, gradeId: scope.gradeId } : null;
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;

  async function refresh() {
    if (!current) return;
    const [nextGroups, nextEdges, nextPeriods, nextTeachers, nextAssignments] = await Promise.all([
      listSelfStudyGroups(current), listSelfStudyGroupPeriods(current), listScopedPeriods(current.academicYearId, current.gradeId), listAssignmentsForGrade(current.academicYearId, current.gradeId), listSupervisionAssignments(current),
    ]);
    setGroups(nextGroups); setEdges(nextEdges); setPeriods(nextPeriods); setTeachers(nextTeachers.filter((item) => item.active));
    setDayAssignments(nextAssignments.filter((item) => item.date === date)); setMonthAssignments(nextAssignments.filter((item) => item.date.startsWith(month)));
  }

  useEffect(() => { void refresh().catch(() => setError("\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.")); }, [current?.academicYearId, current?.gradeId, date, month]);

  const operatingPeriods = useMemo(() => periods.filter((period) => period.active && isPeriodOperatingOn(date, period)).map((period) => ({ ...period, ...periodScheduleForDate(period, date) })).sort((left, right) => left.order - right.order), [date, periods]);
  const matrixGroups = useMemo(() => groups.filter((group) => group.active && edges.some((edge) => edge.active && edge.groupId === group.id && operatingPeriods.some((period) => period.id === edge.periodId))).sort((left, right) => left.sortOrder - right.sortOrder), [edges, groups, operatingPeriods]);
  const calendar = useMemo(() => supervisionCalendarCells(month), [month]);
  const calendarLabel = `${month.slice(0, 4)}\uB144 ${Number(month.slice(5, 7))}\uC6D4`;

  function hasEdge(groupId: string, periodId: string) { return edges.some((edge) => edge.active && edge.groupId === groupId && edge.periodId === periodId); }
  function assignmentsFor(periodId: string, groupId: string) { return dayAssignments.filter((assignment) => assignment.active && assignment.periodId === periodId && assignment.selfStudyGroupId === groupId); }
  const visibleGroups = onlyMissing ? matrixGroups.filter((group) => operatingPeriods.some((period) => hasEdge(group.id, period.id) && assignmentsFor(period.id, group.id).length === 0)) : matrixGroups;
  const missingThisMonth = useMemo(() => calendar.reduce((total, cell) => cell.date ? total + supervisionDaySummary(cell.date, periods, groups, edges, monthAssignments).missing : total, 0), [calendar, edges, groups, monthAssignments, periods]);

  function openCell(period: any, group: any) { setError(""); setSelectedCell({ period, group }); setSelectedTeacherUid(""); }
  async function saveCellAssignment(cell: AssignmentCell, teacherUid: string) {
    const teacher = teachers.find((item) => item.uid === teacherUid);
    if (!current || !actor || !teacher) return;
    setError("");
    try {
      await saveSupervisionAssignment({ academicYearId: current.academicYearId, gradeId: current.gradeId, date, periodId: cell.period.id, selfStudyGroupId: cell.group.id, teacherUid: teacher.uid, teacherDisplayName: teacher.displayName || "\uC774\uB984 \uC815\uBCF4 \uC5C6\uC74C", active: true }, actor, assignmentsFor(cell.period.id, cell.group.id).find((item) => item.teacherUid === teacherUid) ?? null);
      setSelectedCell(null); await refresh();
    } catch (caught) { console.error("[supervisionAssignment]", caught); setError("\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."); }
  }
  async function removeAssignment(assignment: any) {
    if (!actor) return;
    setError("");
    try { await deactivateSupervisionAssignment(assignment, actor); await refresh(); }
    catch (caught) { console.error("[supervisionAssignmentRemove]", caught); setError("\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815\uC744 \uD574\uC81C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."); }
  }
  async function saveManualAssignment() {
    const period = operatingPeriods.find((item) => item.id === manualPeriodId); const group = matrixGroups.find((item) => item.id === manualGroupId);
    if (!period || !group || !manualTeacherUid || !hasEdge(group.id, period.id)) { setError("\uB0A0\uC9DC\uC5D0 \uC6B4\uC601\uD558\uB294 \uAD50\uC2DC\uC640 \uC790\uC2B5\uADF8\uB8F9, \uAC10\uB3C5\uAD50\uC0AC\uB97C \uC120\uD0DD\uD574 \uC8FC\uC138\uC694."); return; }
    await saveCellAssignment({ period, group }, manualTeacherUid); setManualOpen(false);
  }
  async function upload(file: File) {
    if (!current) return;
    setError("");
    const workbook = XLSX.read(await file.arrayBuffer()); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }); const seen = new Set<string>();
    setPreview(rawRows.map((raw, index): ImportPreview => {
      const row = { date: String(raw["\uB0A0\uC9DC"] ?? raw.date ?? ""), period: String(raw["\uAD50\uC2DC"] ?? raw.period ?? ""), group: String(raw["\uC790\uC2B5\uADF8\uB8F9"] ?? raw.group ?? ""), teacher: String(raw["\uAC10\uB3C5\uAD50\uC0AC"] ?? raw.teacher ?? "") };
      const reason = validateSupervisionImportRow(row, { periods, groups, edges, teachers, date: row.date }); const period = periods.find((item) => item.id === row.period || item.name === row.period); const group = groups.find((item) => item.id === row.group || item.displayName === row.group); const matches = teachers.filter((item) => item.uid === row.teacher || item.displayName === row.teacher); const teacher = matches.length === 1 ? matches[0] : undefined; const key = `${row.date}:${period?.id}:${group?.id}:${teacher?.uid}`; const duplicate = !reason && seen.has(key); seen.add(key);
      const unchanged = !reason && !duplicate && monthAssignments.some((item) => item.active && item.date === row.date && item.periodId === period?.id && item.selfStudyGroupId === group?.id && item.teacherUid === teacher?.uid);
      return { index: index + 2, date: row.date, period, group, teacher, reason: reason ?? (duplicate ? "\uD30C\uC77C \uB0B4 \uC911\uBCF5 \uD589" : null), status: reason ? "\uC624\uB958" : duplicate ? "\uC911\uBCF5" : unchanged ? "\uBCC0\uACBD \uC5C6\uC74C" : "\uC2E0\uADDC" };
    }));
  }
  async function commitImport() {
    if (!current || !actor || preview.some((row) => row.reason)) return;
    setError("");
    const values = preview.filter((row) => row.status === "\uC2E0\uADDC").map((row) => ({ value: { academicYearId: current.academicYearId, gradeId: current.gradeId, date: row.date, periodId: row.period!.id, selfStudyGroupId: row.group!.id, teacherUid: row.teacher!.uid, teacherDisplayName: row.teacher!.displayName || "\uC774\uB984 \uC815\uBCF4 \uC5C6\uC74C", active: true }, before: null }));
    try { if (values.length) await saveSupervisionAssignments(values, actor); setPreview([]); await refresh(); }
    catch (caught) { console.error("[supervisionImportCommit]", caught); setError("\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uC785\uB825 \uB0B4\uC6A9\uC744 \uD655\uC778\uD55C \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."); }
  }

  if (!current) return <section className="empty-state"><h2>{"\uD559\uB144\uC744 \uC120\uD0DD\uD558\uC138\uC694."}</h2></section>;
  return <>
    <header className="page-header"><div><div className="eyebrow">{"\uC790\uC2B5 \uAC10\uB3C5 \uAD00\uB9AC"}</div><h2>{"\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815"}</h2><p className="muted">{"\uB0A0\uC9DC\uC640 \uC790\uC2B5\uAD50\uC2DC\uBCC4\uB85C \uC790\uC2B5\uADF8\uB8F9\uC744 \uAC10\uB3C5\uD560 \uAD50\uC0AC\uB97C \uC9C0\uC815\uD569\uB2C8\uB2E4."}</p></div><div className="button-row"><label>{"\uC6D4 \uC120\uD0DD"}<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setDate(dateForMonth(event.target.value, date)); }} /></label><label>{"\uB0A0\uC9DC \uC120\uD0DD"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></div></header>
    <section className="card"><div className="button-row"><button type="button" className={view === "matrix" ? "active" : ""} onClick={() => setView("matrix")}>{"\uBC30\uC815\uD45C"}</button><button type="button" className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>{"\uC6D4\uAC04 \uB2EC\uB825"}</button><button type="button" onClick={() => { setManualOpen(true); setManualPeriodId(operatingPeriods[0]?.id ?? ""); setManualGroupId(matrixGroups[0]?.id ?? ""); setManualTeacherUid(""); }}>{"\uC9C1\uC811 \uCD94\uAC00"}</button><button type="button" onClick={() => uploadInput.current?.click()}>{"Excel \uC5C5\uB85C\uB4DC"}</button><input ref={uploadInput} type="file" accept=".xlsx" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} /><label><input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />{"\uBBF8\uBC30\uC815\uB9CC \uBCF4\uAE30"}</label></div><p className="muted">{"\uC774\uBC88 \uB2EC \uBBF8\uBC30\uC815 "}{missingThisMonth}{"\uAC74"}</p></section>
    {error && <p className="text-danger">{error}</p>}
    {view === "matrix" ? <section className="card table-wrap"><h3>{date} {"\uBC30\uC815\uD45C"}</h3>{operatingPeriods.length === 0 || visibleGroups.length === 0 ? <div className="empty-state">{"\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uBC30\uC815\uD560 \uC790\uC2B5\uADF8\uB8F9\uACFC \uC6B4\uC601 \uAD50\uC2DC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4."}</div> : <table><thead><tr><th>{"\uC790\uC2B5\uADF8\uB8F9 / \uC790\uC2B5\uC2E4"}</th>{operatingPeriods.map((period) => { const schedule = periodScheduleForDate(period, date); return <th key={period.id}>{period.name}<br /><span className="muted">{schedule.startTime} ~ {schedule.endTime}</span></th>; })}</tr></thead><tbody>{visibleGroups.map((group) => <tr key={group.id}><th>{group.displayName}</th>{operatingPeriods.map((period) => { if (!hasEdge(group.id, period.id)) return <td key={period.id}>-</td>; const assignments = assignmentsFor(period.id, group.id); return <td key={period.id}><button type="button" className={assignments.length ? "assignment-cell" : "assignment-cell assignment-cell-missing"} onClick={() => openCell(period, group)}>{assignments.length ? assignments.map((item) => item.teacherDisplayName).join(", ") : "\uBBF8\uBC30\uC815"}</button></td>; })}</tr>)}</tbody></table>}</section> : <section className="supervision-calendar"><div className="supervision-calendar-toolbar"><button type="button" className="small" onClick={() => { const next = shiftSupervisionCalendarMonth(month, -1); setMonth(next); setDate(dateForMonth(next, date)); }}>{"\uC774\uC804"}</button><strong>{calendarLabel}</strong><button type="button" className="small" onClick={() => { const next = shiftSupervisionCalendarMonth(month, 1); setMonth(next); setDate(dateForMonth(next, date)); }}>{"\uB2E4\uC74C"}</button></div><div className="supervision-calendar-weekdays">{SUPERVISION_CALENDAR_WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div><div className="supervision-calendar-grid">{calendar.map((cell, index) => !cell.date ? <div className="supervision-calendar-empty" key={`empty-${index}`} /> : (() => { const summary = supervisionDaySummary(cell.date!, periods, groups, edges, monthAssignments); const label = summary.operatingPeriods === 0 ? "\uC6B4\uC601 \uC5C6\uC74C" : `\uC6B4\uC601 ${summary.operatingPeriods}`; return <button type="button" className={`supervision-calendar-day ${cell.date === date ? "is-selected" : ""} ${cell.date === today() ? "is-today" : ""}`} key={cell.date} onClick={() => { setDate(cell.date!); setView("matrix"); }}><strong>{cell.day}</strong><span>{label}</span>{summary.operatingPeriods > 0 && <><span>{"\uBC30\uC815 "}{summary.assigned}</span><span className={summary.missing ? "calendar-missing" : ""}>{"\uBBF8\uBC30\uC815 "}{summary.missing}</span></>}</button>; })())}</div></section>}
    {selectedCell && <section className="card"><h3>{selectedCell.group.displayName} · {selectedCell.period.name}</h3><p className="muted">{"\uAC10\uB3C5\uAD50\uC0AC\uB97C \uD655\uC778\uD558\uAC70\uB098 \uCD94\uAC00 \uBC30\uC815\uD558\uC138\uC694."}</p>{assignmentsFor(selectedCell.period.id, selectedCell.group.id).map((assignment) => <p key={assignment.id}>{assignment.teacherDisplayName} <button type="button" onClick={() => void removeAssignment(assignment)}>{"\uD574\uC81C"}</button></p>)}<div className="button-row"><select value={selectedTeacherUid} onChange={(event) => setSelectedTeacherUid(event.target.value)}><option value="">{"\uAC10\uB3C5\uAD50\uC0AC \uC120\uD0DD"}</option>{teachers.filter((teacher) => !assignmentsFor(selectedCell.period.id, selectedCell.group.id).some((assignment) => assignment.teacherUid === teacher.uid)).map((teacher) => <option key={teacher.uid} value={teacher.uid}>{teacher.displayName || "\uC774\uB984 \uC815\uBCF4 \uC5C6\uC74C"}</option>)}</select><button type="button" disabled={!selectedTeacherUid} onClick={() => void saveCellAssignment(selectedCell, selectedTeacherUid)}>{"\uC800\uC7A5"}</button><button type="button" onClick={() => setSelectedCell(null)}>{"\uB2EB\uAE30"}</button></div></section>}
    {manualOpen && <section className="card"><h3>{"\uAC10\uB3C5\uAD50\uC0AC \uC9C1\uC811 \uCD94\uAC00"}</h3><div className="filter-grid"><label>{"\uB0A0\uC9DC"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>{"\uAD50\uC2DC"}<select value={manualPeriodId} onChange={(event) => setManualPeriodId(event.target.value)}><option value="">{"\uAD50\uC2DC \uC120\uD0DD"}</option>{operatingPeriods.map((period) => <option key={period.id} value={period.id}>{period.name}</option>)}</select></label><label>{"\uC790\uC2B5\uADF8\uB8F9 / \uC790\uC2B5\uC2E4"}<select value={manualGroupId} onChange={(event) => setManualGroupId(event.target.value)}><option value="">{"\uC790\uC2B5\uADF8\uB8F9 \uC120\uD0DD"}</option>{matrixGroups.filter((group) => !manualPeriodId || hasEdge(group.id, manualPeriodId)).map((group) => <option key={group.id} value={group.id}>{group.displayName}</option>)}</select></label><label>{"\uAC10\uB3C5\uAD50\uC0AC"}<select value={manualTeacherUid} onChange={(event) => setManualTeacherUid(event.target.value)}><option value="">{"\uAC10\uB3C5\uAD50\uC0AC \uC120\uD0DD"}</option>{teachers.map((teacher) => <option key={teacher.uid} value={teacher.uid}>{teacher.displayName || "\uC774\uB984 \uC815\uBCF4 \uC5C6\uC74C"}</option>)}</select></label></div><div className="button-row"><button type="button" onClick={() => void saveManualAssignment()}>{"\uC800\uC7A5"}</button><button type="button" onClick={() => setManualOpen(false)}>{"\uCDE8\uC18C"}</button></div></section>}
    {preview.length > 0 && <section className="card"><h3>{"Excel \uBBF8\uB9AC\uBCF4\uAE30"}</h3><div className="table-wrap"><table><thead><tr><th>{"\uD589"}</th><th>{"\uC0C1\uD0DC"}</th><th>{"\uC548\uB0B4"}</th></tr></thead><tbody>{preview.map((row) => <tr key={row.index}><td>{row.index}</td><td>{row.status}</td><td>{row.reason ?? "\uC800\uC7A5 \uAC00\uB2A5"}</td></tr>)}</tbody></table></div><div className="button-row"><button type="button" disabled={preview.some((row) => row.reason)} onClick={() => void commitImport()}>{"\uD655\uC778 \uD6C4 \uC800\uC7A5"}</button><button type="button" onClick={() => setPreview([])}>{"\uCDE8\uC18C"}</button></div></section>}
  </>;
}
