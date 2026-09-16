import {
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { canViewStats, isGradeAdmin } from "../domain/access";
import { summarizeAttendance } from "../domain/statistics";
import { exportStatsExcel } from "../lib/excel";
import { listAttendanceByRange } from "../services/attendance";
import { listPeriods, listStudents } from "../services/masterData";
import { getAccessSettings } from "../services/settings";
import { listSelfStudyExceptions } from "../services/selfStudyExceptions";
import type { AccessSettings, AttendanceRecord, AttendanceStatus, Period, Student } from "../types/domain";

type Mode = "week" | "month" | "custom";
type Tab = "class" | "student" | "period";

export function StatsPage() {
  const { appUser } = useAuth();
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState(format(new Date(), "yyyy-MM-dd"));
  const [customStart, setCustomStart] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [tab, setTab] = useState<Tab>("class");
  const [busy, setBusy] = useState(false);
  const [excludedDates, setExcludedDates] = useState<Set<string>>(new Set());

  useEffect(() => { void Promise.all([getAccessSettings(), listStudents(), listPeriods(), listSelfStudyExceptions()]).then(([a,s,p,exceptions]) => { setSettings(a); setStudents(s); setPeriods(p); setExcludedDates(new Set(exceptions.filter((item) => item.enabled).map((item) => item.date))); }); }, []);
  const allowed = useMemo(() => canViewStats(appUser, settings), [appUser, settings]);

  const range = useMemo(() => {
    if (mode === "custom") return { start: customStart, end: customEnd };
    const d = parseISO(anchor);
    if (mode === "week") return { start: format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd"), end: format(endOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    return { start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
  }, [mode, anchor, customStart, customEnd]);

  async function load() {
    if (!allowed) return;
    setBusy(true);
    try { setRecords(await listAttendanceByRange(range.start, range.end)); } finally { setBusy(false); }
  }
  useEffect(() => { if (allowed) void load(); }, [allowed, range.start, range.end]);

  if (!settings) return <div>통계 권한 확인 중…</div>;
  if (!allowed) return <div className="card narrow"><h2>통계 접근 권한 없음</h2><p>학년부 또는 통계 열람이 허용된 담임 계정만 사용할 수 있습니다.</p></div>;

  const scoped = !isGradeAdmin(appUser) && settings.homeroomStatsScope === "own_class" && appUser?.homeroomClassId
    ? records.filter((r) => r.classId === appUser.homeroomClassId)
    : records;
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const periodMap = new Map(periods.map((p) => [p.id, p]));
  const summaries = summarizeAttendance(scoped, tab, students, false, excludedDates).map((summary) => {
    const student = studentMap.get(summary.key);
    const label = tab === "class" ? summary.key : tab === "student" ? student ? `${student.classId} ${student.studentNo}. ${student.name}` : summary.key : periodMap.get(summary.key)?.name ?? summary.key;
    return { ...summary, label };
  }).sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const exportRows = summaries.map((s) => ({ 구분: s.label, 출석: s.present, 지각: s.late, 결석: s.absent, 인정: s.excused, 조퇴: s.early_leave, 기록수: s.total, "정상출석률(%)": Number(s.rate.toFixed(1)) }));

  return (
    <>
      <header className="page-header"><div><div className="eyebrow">{"\uC8FC\uBCC4 / \uC6D4\uBCC4 / \uC9C1\uC811 \uC120\uD0DD"}</div><h2>출결 통계</h2></div><button onClick={() => void exportStatsExcel(exportRows, `출결통계_${range.start}_${range.end}_${tab}.xlsx`)}>Excel 다운로드</button></header>
      <section className="card filter-grid">
        <label>기간 단위<select value={mode} onChange={(e) => setMode(e.target.value as Mode)}><option value="week">주별</option><option value="month">월별</option><option value="custom">직접 선택</option></select></label>
        {mode !== "custom" ? <label>기준 날짜<input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} /></label> : <><label>시작일<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></label><label>종료일<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></label></>}
        <div className="duty-readout"><strong>{range.start}</strong> ~ <strong>{range.end}</strong></div>
      </section>
      <div className="tabs"><button className={tab === "class" ? "active" : ""} onClick={() => setTab("class")}>반별</button><button className={tab === "student" ? "active" : ""} onClick={() => setTab("student")}>학생별</button><button className={tab === "period" ? "active" : ""} onClick={() => setTab("period")}>교시별</button></div>
      <section className="card">
        <div className="section-title-row"><h3>{tab === "class" ? "반별" : tab === "student" ? "학생별" : "교시별"} 통계</h3><span className="muted">{busy ? "집계 중…" : `${scoped.length}개 출결 기록 기준`}</span></div>
        <div className="table-wrap"><table>
          <thead><tr><th>구분</th><th>출석</th><th>지각</th><th>결석</th><th>인정</th><th>조퇴</th><th>기록수</th><th>정상출석률</th></tr></thead>
          <tbody>{summaries.map((s) => <tr key={s.key}><td><strong>{s.label}</strong></td><td>{s.present}</td><td>{s.late}</td><td>{s.absent}</td><td>{s.excused}</td><td>{s.early_leave}</td><td>{s.total}</td><td>{s.rate.toFixed(1)}%</td></tr>)}</tbody>
        </table></div>
        <p className="muted">현재 정상출석률은 저장된 기록 중 `출석` 비율입니다. 학교의 인정결석/인정출석 산정 규칙이 정해지면 계산식을 설정값으로 분리할 수 있습니다.</p>
      </section>
    </>
  );
}
