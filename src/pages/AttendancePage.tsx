import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { canManageAttendance } from "../domain/access";
import { isSelfStudyDate, SUNDAY_SELF_STUDY_MESSAGE } from "../domain/schedule";
import { listAttendance, markAttendance, markStudentsPresent } from "../services/attendance";
import { getDutyAssignment } from "../services/duty";
import { getSelfStudyException } from "../services/selfStudyExceptions";
import { listPeriods, listStudents } from "../services/masterData";
import type { AttendanceRecord, AttendanceStatus, DutyAssignment, Period, SelfStudyException, Student } from "../types/domain";

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "출석",
  late: "지각",
  absent: "결석",
  excused: "인정",
  early_leave: "조퇴",
};

export function AttendancePage() {
  const { appUser } = useAuth();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [students, setStudents] = useState<Student[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [duty, setDuty] = useState<DutyAssignment | null>(null);
  const [exception, setException] = useState<SelfStudyException | null>(null);
  const [classId, setClassId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([listStudents(), listPeriods()]).then(([s, p]) => {
      const activeStudents = s.filter((x) => x.active);
      const activePeriods = p.filter((x) => x.active);
      setStudents(activeStudents);
      setPeriods(activePeriods);
      if (!classId && activeStudents[0]) setClassId(activeStudents[0].classId);
      if (!periodId && activePeriods[0]) setPeriodId(activePeriods[0].id);
    });
  }, []);

  async function refreshDate(nextDate = date) {
    const [r, d] = await Promise.all([listAttendance(nextDate), getDutyAssignment(nextDate)]);
    setRecords(r);
    setDuty(d);
  }

  useEffect(() => { void refreshDate(date); void getSelfStudyException(date).then(setException); }, [date]);

  const selfStudyDay = isSelfStudyDate(date, exception);
  const editable = selfStudyDay && canManageAttendance(appUser, duty, periodId);
  const classes = useMemo(() => [...new Set(students.map((s) => s.classId))].sort(), [students]);
  const visible = students.filter((s) => s.classId === classId);

  function recordFor(studentId: string) {
    return records.find((r) => r.studentId === studentId && r.classId === classId && r.periodId === periodId);
  }

  async function setStatus(student: Student, status: AttendanceStatus) {
    if (!appUser || !editable) return;
    setBusy(true);
    try {
      await markAttendance({ date, studentId: student.id, classId, periodId, status, actor: { uid: appUser.uid, name: appUser.displayName }, before: recordFor(student.id) ?? null });
      await refreshDate();
    } finally { setBusy(false); }
  }

  async function markAllPresent() {
    if (!appUser || !editable || !visible.length) return;
    setBusy(true);
    try {
      await markStudentsPresent({ date, students: visible, classId, periodId, actor: { uid: appUser.uid, name: appUser.displayName } });
      await refreshDate();
    } finally { setBusy(false); }
  }

  const enteredCount = visible.filter((s) => Boolean(recordFor(s.id))).length;

  return (
    <>
      <header className="page-header">
        <div><div className="eyebrow">DAILY ATTENDANCE</div><h2>출결 관리</h2></div>
        <span className={`status-pill ${editable ? "success" : ""}`}>{editable ? "편집 가능" : "뷰어 모드"}</span>
      </header>

      <section className="toolbar card">
        <label>날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label>반<select value={classId} onChange={(e) => setClassId(e.target.value)}>{classes.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>교시<select value={periodId} onChange={(e) => setPeriodId(e.target.value)}>{periods.map((x) => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
        <div className="duty-readout">담당: <strong>{duty?.teacherName ?? "미배정"}</strong></div>
      </section>

      {!selfStudyDay && <section className="card"><p className="text-danger">{SUNDAY_SELF_STUDY_MESSAGE}</p></section>}
      <section className="card attendance-summary">
        <div><span className="muted">입력 진행</span><h3>{enteredCount} / {visible.length}명</h3></div>
        {editable && <button className="primary" disabled={busy || !visible.length} onClick={() => void markAllPresent()}>현재 반 전체 출석 처리</button>}
      </section>

      <section className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>번호</th><th>이름</th><th>상태</th><th>빠른 변경</th></tr></thead>
            <tbody>{visible.map((student) => {
              const record = recordFor(student.id);
              return (
                <tr key={student.id}>
                  <td>{student.studentNo}</td><td><strong>{student.name}</strong></td>
                  <td>{record ? <span className={`attendance-tag ${record.status}`}>{STATUS_LABEL[record.status]}</span> : <span className="attendance-tag unmarked">미입력</span>}</td>
                  <td><div className="button-row">{(Object.keys(STATUS_LABEL) as AttendanceStatus[]).map((s) => (
                    <button key={s} className={record?.status === s ? "small active" : "small"} disabled={!editable || busy} onClick={() => void setStatus(student, s)}>{STATUS_LABEL[s]}</button>
                  ))}</div></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
