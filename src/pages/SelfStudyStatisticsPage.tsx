import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { selfStudyAttendanceCoverage } from "../domain/selfStudyStatistics";
import { statisticsAggregateHeading, statisticsHeading, type StatisticsAggregate } from "../domain/statisticsPresentation";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { listClasses } from "../services/classes";
import { listScopedPeriods } from "../services/scopedPeriods";
import { listScopedStudents } from "../services/scopedStudents";
import { listSelfStudyExceptions } from "../services/selfStudyExceptions";
import { listSelfStudyGroupPeriods, listSelfStudyGroups, listSelfStudyMemberships } from "../services/selfStudyOperations";
import { listSelfStudyAttendanceHistory, summarizeSelfStudyAttendance, summarizeSelfStudyAttendanceBy } from "../services/selfStudyReporting";
import { useScope } from "../scope/ScopeProvider";

const day = (value: Date) => format(value, "yyyy-MM-dd");
const aggregateOptions: Array<{ value: StatisticsAggregate; label: string }> = [
  { value: "all", label: "\uC804\uCCB4" }, { value: "class", label: "\uD559\uAE09\uBCC4" }, { value: "group", label: "\uC790\uC2B5\uADF8\uB8F9\uBCC4" }, { value: "period", label: "\uAD50\uC2DC\uBCC4" }, { value: "student", label: "\uD559\uC0DD\uBCC4" },
];

export function SelfStudyStatisticsPage() {
  const { appUser } = useAuth();
  const { scope, assignments } = useScope();
  const [start, setStart] = useState(day(startOfMonth(new Date())));
  const [end, setEnd] = useState(day(new Date()));
  const [mode, setMode] = useState("month");
  const [classId, setClassId] = useState(""); const [groupId, setGroupId] = useState(""); const [periodId, setPeriodId] = useState(""); const [studentId, setStudentId] = useState(""); const [status, setStatus] = useState(""); const [aggregate, setAggregate] = useState<StatisticsAggregate>("student");
  const [records, setRecords] = useState<any[]>([]); const [classes, setClasses] = useState<any[]>([]); const [students, setStudents] = useState<any[]>([]); const [groups, setGroups] = useState<any[]>([]); const [periods, setPeriods] = useState<any[]>([]); const [memberships, setMemberships] = useState<any[]>([]); const [coverage, setCoverage] = useState({ expected: 0, missing: 0 });
  const current = scope?.gradeId ? { academicYearId: scope.academicYearId, gradeId: scope.gradeId } : null;
  const owner = isSystemOwner(appUser); const admin = Boolean(appUser && current && isGradeAdminForGrade(assignments, appUser.uid, current.academicYearId, current.gradeId));

  useEffect(() => {
    if (!current) return;
    void Promise.all([listClasses(current.academicYearId, current.gradeId), listScopedStudents(current), listSelfStudyGroups(current), listScopedPeriods(current.academicYearId, current.gradeId), listSelfStudyMemberships(current)]).then(([nextClasses, nextStudents, nextGroups, nextPeriods, nextMemberships]) => {
      setClasses(nextClasses); setStudents(nextStudents); setGroups(nextGroups); setPeriods(nextPeriods); setMemberships(nextMemberships);
    });
  }, [current?.academicYearId, current?.gradeId]);

  const ownClassId = classes.find((item) => item.active && item.homeroomTeacherUid === appUser?.uid)?.id;
  const effectiveClassId = owner || admin ? classId : ownClassId ?? "";
  const eligibleStudents = useMemo(() => students.filter((student) => student.active && (!effectiveClassId || student.classId === effectiveClassId) && (!groupId || memberships.some((membership) => membership.active && membership.studentId === student.id && membership.selfStudyGroupId === groupId))), [effectiveClassId, groupId, memberships, students]);
  useEffect(() => { if (studentId && !eligibleStudents.some((student) => student.id === studentId)) setStudentId(""); }, [eligibleStudents, studentId]);
  useEffect(() => {
    if (!current || (!owner && !admin && !ownClassId)) return;
    void Promise.all([
      listSelfStudyAttendanceHistory({ ...current, startDate: start, endDate: end, ...(effectiveClassId ? { classId: effectiveClassId } : {}), ...(groupId ? { selfStudyGroupId: groupId } : {}), ...(periodId ? { periodId } : {}), ...(studentId ? { studentId } : {}), ...(status ? { status: status as any } : {}) }),
      listSelfStudyGroupPeriods(current), listSelfStudyExceptions(current),
    ]).then(([nextRecords, edges, exceptions]) => {
      setRecords(nextRecords);
      setCoverage(selfStudyAttendanceCoverage({ startDate: start, endDate: end, memberships: memberships.filter((membership) => membership.active && (!effectiveClassId || membership.classId === effectiveClassId) && (!groupId || membership.selfStudyGroupId === groupId) && (!studentId || membership.studentId === studentId)), edges, periods, exceptions, records: nextRecords }));
    });
  }, [admin, current?.academicYearId, current?.gradeId, effectiveClassId, end, groupId, memberships, ownClassId, owner, periodId, periods, start, status, studentId]);

  function setRange(next: string) {
    setMode(next); const now = new Date();
    if (next === "day") { setStart(day(now)); setEnd(day(now)); }
    if (next === "week") { setStart(day(startOfWeek(now, { weekStartsOn: 1 }))); setEnd(day(endOfWeek(now, { weekStartsOn: 1 }))); }
    if (next === "month") { setStart(day(startOfMonth(now))); setEnd(day(endOfMonth(now))); }
  }
  const counts = summarizeSelfStudyAttendance(records);
  const labels = new Map([...classes, ...groups, ...periods, ...students].map((item: any) => [item.id, item.displayName ?? item.name]));
  const groupKey = (record: any) => aggregate === "class" ? record.classId : aggregate === "group" ? record.selfStudyGroupId : aggregate === "period" ? record.periodId : aggregate === "student" ? record.studentId : "all";
  const rows = [...summarizeSelfStudyAttendanceBy(records, groupKey)];
  const className = classes.find((item) => item.id === effectiveClassId)?.displayName;
  const title = statisticsHeading({ startDate: start, endDate: end, mode, gradeName: "\uC120\uD0DD \uD559\uB144", className });

  if (!current) return <section className="empty-state"><h2>{"\uD559\uB144\uC744 \uC120\uD0DD\uD558\uC138\uC694."}</h2></section>;
  return <>
    <header className="page-header"><div><div className="eyebrow">{"\uC790\uC2B5 \uCD9C\uACB0 \uD1B5\uACC4"}</div><h2>{title}</h2><p className="muted">{"\uC120\uD0DD\uD55C \uAE30\uAC04\uACFC \uBC94\uC704\uC758 \uC790\uC728\uD559\uC2B5 \uCD9C\uACB0 \uD1B5\uACC4\uC785\uB2C8\uB2E4."}</p></div></header>
    <section className="card filter-grid"><label>{"\uAE30\uAC04"}<select value={mode} onChange={(event) => setRange(event.target.value)}><option value="day">{"\uC77C\uBCC4"}</option><option value="week">{"\uC8FC\uBCC4"}</option><option value="month">{"\uC6D4\uBCC4"}</option><option value="custom">{"\uC0AC\uC6A9\uC790 \uC9C0\uC815"}</option></select></label><label>{"\uC2DC\uC791"}<input type="date" value={start} onChange={(event) => { setMode("custom"); setStart(event.target.value); }} /></label><label>{"\uC885\uB8CC"}<input type="date" value={end} onChange={(event) => { setMode("custom"); setEnd(event.target.value); }} /></label><label>{"\uD559\uAE09"}<select value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>{"\uC790\uC2B5\uADF8\uB8F9"}<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>{"\uAD50\uC2DC"}<select value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{"\uD559\uC0DD"}<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{eligibleStudents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{"\uC0C1\uD0DC"}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{"\uC804\uCCB4"}</option><option value="PRESENT">{"\uCD9C\uC11D"}</option><option value="EXCUSED_ABSENCE">{"\uC778\uC815 \uACB0\uC11D"}</option><option value="UNEXCUSED_ABSENCE">{"\uBB34\uB2E8 \uACB0\uC11D"}</option></select></label><label>{"\uC9D1\uACC4"}<select value={aggregate} onChange={(event) => setAggregate(event.target.value as StatisticsAggregate)}>{aggregateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" onClick={() => { setRange("month"); setClassId(""); setGroupId(""); setPeriodId(""); setStudentId(""); setStatus(""); }}>{"\uCD08\uAE30\uD654"}</button></section>
    <section className="card"><h3>{"\uCD9C\uACB0 \uC0C1\uD0DC \uBD84\uD3EC"}</h3><div className="self-study-counts"><strong>{"\uC608\uC0C1 "}{coverage.expected}</strong><span>{"\uCD9C\uC11D "}{counts.present}</span><span>{"\uC778\uC815 \uACB0\uC11D "}{counts.excused}</span><span>{"\uBB34\uB2E8 \uACB0\uC11D "}{counts.unexcused}</span><span>{"\uBBF8\uC785\uB825 "}{coverage.missing}</span></div><p className="muted">{"\uBBF8\uC785\uB825\uC740 \uAE30\uB85D \uC5C6\uC74C\uC774\uBA70 \uBB34\uB2E8 \uACB0\uC11D\uC73C\uB85C \uC790\uB3D9 \uCC98\uB9AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."}</p></section>
    <section className="card table-wrap"><h3>{statisticsAggregateHeading(aggregate)}</h3><table><thead><tr><th>{"\uAD6C\uBD84"}</th><th>{"\uCD9C\uC11D"}</th><th>{"\uC778\uC815 \uACB0\uC11D"}</th><th>{"\uBB34\uB2E8 \uACB0\uC11D"}</th></tr></thead><tbody>{rows.map(([id, count]) => <tr key={id}><td>{aggregate === "all" ? "\uC804\uCCB4" : labels.get(id) ?? "-"}</td><td>{count.present}</td><td>{count.excused}</td><td>{count.unexcused}</td></tr>)}</tbody></table></section>
  </>;
}
