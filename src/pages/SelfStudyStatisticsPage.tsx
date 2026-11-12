import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { selfStudyAttendanceCoverage } from "../domain/selfStudyStatistics";
import { statisticsAggregateHeading, statisticsHeading, type StatisticsAggregate } from "../domain/statisticsPresentation";
import { isGradeAdminForGrade, isSystemOwner, statisticsClassScope, statisticsClassSelect } from "../domain/scope";
import { listClasses } from "../services/classes";
import { listScopedPeriods } from "../services/scopedPeriods";
import { listScopedStudents } from "../services/scopedStudents";
import { listSelfStudyExceptions } from "../services/selfStudyExceptions";
import { listSelfStudyGroupPeriods, listSelfStudyGroups, listSelfStudyMemberships } from "../services/selfStudyOperations";
import { listSelfStudyAttendanceHistory, summarizeSelfStudyAttendance, summarizeSelfStudyAttendanceBy } from "../services/selfStudyReporting";
import { getAccessSettings } from "../services/settings";
import { useScope } from "../scope/ScopeProvider";
import type { AccessSettings } from "../types/domain";

const day = (value: Date) => format(value, "yyyy-MM-dd");
const aggregateOptions: Array<{ value: StatisticsAggregate; label: string }> = [
  { value: "all", label: "전체" }, { value: "class", label: "학급별" }, { value: "group", label: "자습그룹별" }, { value: "period", label: "교시별" }, { value: "student", label: "학생별" },
];

export function SelfStudyStatisticsPage() {
  const { appUser } = useAuth();
  const { scope, assignments } = useScope();
  const [start, setStart] = useState(day(startOfMonth(new Date())));
  const [end, setEnd] = useState(day(new Date()));
  const [mode, setMode] = useState("month");
  const [classId, setClassId] = useState(""); const [groupId, setGroupId] = useState(""); const [periodId, setPeriodId] = useState(""); const [studentId, setStudentId] = useState(""); const [status, setStatus] = useState(""); const [aggregate, setAggregate] = useState<StatisticsAggregate>("student");
  const [records, setRecords] = useState<any[]>([]); const [classes, setClasses] = useState<any[]>([]); const [classesLoaded, setClassesLoaded] = useState(false); const [accessSettings, setAccessSettings] = useState<AccessSettings | null>(null); const [settingsLoaded, setSettingsLoaded] = useState(false); const [students, setStudents] = useState<any[]>([]); const [groups, setGroups] = useState<any[]>([]); const [periods, setPeriods] = useState<any[]>([]); const [memberships, setMemberships] = useState<any[]>([]); const [coverage, setCoverage] = useState({ expected: 0, missing: 0 });
  const current = scope?.gradeId ? { academicYearId: scope.academicYearId, gradeId: scope.gradeId } : null;
  const owner = isSystemOwner(appUser); const admin = Boolean(appUser && current && isGradeAdminForGrade(assignments, appUser.uid, current.academicYearId, current.gradeId));

  // Missing or unreadable settings keep homeroom statistics closed (fail-closed).
  useEffect(() => { void getAccessSettings().then(setAccessSettings, () => setAccessSettings(null)).finally(() => setSettingsLoaded(true)); }, []);
  useEffect(() => {
    if (!current) return;
    setClassesLoaded(false);
    void Promise.all([listClasses(current.academicYearId, current.gradeId), listScopedStudents(current), listSelfStudyGroups(current), listScopedPeriods(current.academicYearId, current.gradeId), listSelfStudyMemberships(current)]).then(([nextClasses, nextStudents, nextGroups, nextPeriods, nextMemberships]) => {
      setClasses(nextClasses); setClassesLoaded(true); setStudents(nextStudents); setGroups(nextGroups); setPeriods(nextPeriods); setMemberships(nextMemberships);
    });
  }, [current?.academicYearId, current?.gradeId]);

  const ownClassId = classes.find((item) => item.active && item.homeroomTeacherUid === appUser?.uid)?.id;
  const classScope = statisticsClassScope({ canViewGrade: owner || admin, selectedClassId: classId, ownClassId, settings: accessSettings }); const effectiveClassId = classScope ?? "";
  const classSelect = statisticsClassSelect({ canViewGrade: owner || admin, classScope, classes });
  const eligibleStudents = useMemo(() => students.filter((student) => student.active && (!effectiveClassId || student.classId === effectiveClassId) && (!groupId || memberships.some((membership) => membership.active && membership.studentId === student.id && membership.selfStudyGroupId === groupId))), [effectiveClassId, groupId, memberships, students]);
  useEffect(() => { if (studentId && !eligibleStudents.some((student) => student.id === studentId)) setStudentId(""); }, [eligibleStudents, studentId]);
  useEffect(() => {
    if (!current || classScope === null) return;
    void Promise.all([
      listSelfStudyAttendanceHistory({ ...current, startDate: start, endDate: end, ...(effectiveClassId ? { classId: effectiveClassId } : {}), ...(groupId ? { selfStudyGroupId: groupId } : {}), ...(periodId ? { periodId } : {}), ...(studentId ? { studentId } : {}), ...(status ? { status: status as any } : {}) }),
      listSelfStudyGroupPeriods(current), listSelfStudyExceptions(current),
    ]).then(([nextRecords, edges, exceptions]) => {
      setRecords(nextRecords);
      setCoverage(selfStudyAttendanceCoverage({ startDate: start, endDate: end, memberships: memberships.filter((membership) => membership.active && (!effectiveClassId || membership.classId === effectiveClassId) && (!groupId || membership.selfStudyGroupId === groupId) && (!studentId || membership.studentId === studentId)), edges, periods, exceptions, records: nextRecords }));
    });
  }, [classScope, current?.academicYearId, current?.gradeId, effectiveClassId, end, groupId, memberships, periodId, periods, start, status, studentId]);

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
  const title = statisticsHeading({ startDate: start, endDate: end, mode, gradeName: "선택 학년", className });

  if (!current) return <section className="empty-state"><h2>{"학년을 선택하세요."}</h2></section>;
  if (classScope === null && classesLoaded && settingsLoaded) return <section className="empty-state"><h2>{"통계를 조회할 권한이 없습니다."}</h2><p className="muted">{"학년부는 학년 전체를, 담임 교사는 시스템 관리자가 담임 통계 열람을 허용한 경우 본인 반만 조회할 수 있습니다."}</p></section>;
  return <>
    <header className="page-header"><div><div className="eyebrow">{"자습 출결 통계"}</div><h2>{title}</h2><p className="muted">{"선택한 기간과 범위의 자율학습 출결 통계입니다."}</p></div></header>
    <section className="card filter-grid"><label>{"기간"}<select value={mode} onChange={(event) => setRange(event.target.value)}><option value="day">{"일별"}</option><option value="week">{"주별"}</option><option value="month">{"월별"}</option><option value="custom">{"사용자 지정"}</option></select></label><label>{"시작"}<input type="date" value={start} onChange={(event) => { setMode("custom"); setStart(event.target.value); }} /></label><label>{"종료"}<input type="date" value={end} onChange={(event) => { setMode("custom"); setEnd(event.target.value); }} /></label><label>{"학급"}<select value={classSelect.value} disabled={classSelect.locked} onChange={(event) => setClassId(event.target.value)}>{!classSelect.locked && <option value="">{"전체"}</option>}{classSelect.options.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>{"자습그룹"}<select value={groupId} onChange={(event) => setGroupId(event.target.value)}><option value="">{"전체"}</option>{groups.map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>{"교시"}<select value={periodId} onChange={(event) => setPeriodId(event.target.value)}><option value="">{"전체"}</option>{periods.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{"학생"}<select value={studentId} onChange={(event) => setStudentId(event.target.value)}><option value="">{"전체"}</option>{eligibleStudents.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>{"상태"}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{"전체"}</option><option value="PRESENT">{"출석"}</option><option value="EXCUSED_ABSENCE">{"인정 결석"}</option><option value="UNEXCUSED_ABSENCE">{"무단 결석"}</option></select></label><label>{"집계"}<select value={aggregate} onChange={(event) => setAggregate(event.target.value as StatisticsAggregate)}>{aggregateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button type="button" onClick={() => { setRange("month"); setClassId(""); setGroupId(""); setPeriodId(""); setStudentId(""); setStatus(""); }}>{"초기화"}</button></section>
    <section className="card"><h3>{"출결 상태 분포"}</h3><div className="self-study-counts"><strong>{"예상 "}{coverage.expected}</strong><span>{"출석 "}{counts.present}</span><span>{"인정 결석 "}{counts.excused}</span><span>{"무단 결석 "}{counts.unexcused}</span><span>{"미입력 "}{coverage.missing}</span></div><p className="muted">{"미입력은 기록 없음이며 무단 결석으로 자동 처리하지 않습니다."}</p></section>
    <section className="card table-wrap"><h3>{statisticsAggregateHeading(aggregate)}</h3><table><thead><tr><th>{"구분"}</th><th>{"출석"}</th><th>{"인정 결석"}</th><th>{"무단 결석"}</th></tr></thead><tbody>{rows.map(([id, count]) => <tr key={id}><td>{aggregate === "all" ? "전체" : labels.get(id) ?? "-"}</td><td>{count.present}</td><td>{count.excused}</td><td>{count.unexcused}</td></tr>)}</tbody></table></section>
  </>;
}
