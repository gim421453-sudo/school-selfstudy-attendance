import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { isPeriodOperatingOn, periodScheduleForDate } from "../domain/schedule";
import { safeLoadError } from "../domain/presentation";
import { buildBulkPresentDraft, countUnenteredSelfStudyAttendance, isSelfStudySupervisorEditable, resolveSelfStudyAttendanceDisplayStatus, selectInitialSelfStudyGroupId, SELF_STUDY_ATTENDANCE_LABELS, type SelfStudyAttendanceDraft } from "../domain/selfStudyOperation";
import { listScopedPeriods, type ScopedPeriod } from "../services/scopedPeriods";
import { listSelfStudyAttendanceReadRows, writeSelfStudyAttendance } from "../services/selfStudyAttendance";
import { listSelfStudyGroupPeriods, listSelfStudyGroups, listSupervisionAssignments, supervisedGroupIdsForTeacher } from "../services/selfStudyOperations";
import { useScope } from "../scope/ScopeProvider";
import type { SelfStudyAttendanceReadRow, SupervisionAssignment } from "../types/domain";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function timestampToDate(value: unknown): Date | null {
  return value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : null;
}

function canEditAssignment(assignment: SupervisionAssignment | undefined) {
  const from = timestampToDate(assignment?.editableFrom);
  const until = timestampToDate(assignment?.editableUntil);
  const now = new Date();
  return Boolean(assignment?.active && isSelfStudySupervisorEditable(from, until, now));
}

function statusClass(status: string | null) {
  return status === "PRESENT" ? "present" : status === "EXCUSED_ABSENCE" ? "excused" : status === "UNEXCUSED_ABSENCE" ? "unexcused" : "unmarked";
}

export function SelfStudyAttendancePage() {
  const { appUser } = useAuth();
  const { scope, assignments, loading: scopeLoading } = useScope();
  const [date, setDate] = useState(today());
  const [periods, setPeriods] = useState<ScopedPeriod[]>([]);
  const [allAssignments, setAllAssignments] = useState<SupervisionAssignment[]>([]);
  const [groups, setGroups] = useState<{ id: string; displayName: string; active: boolean }[]>([]);
  const [edges, setEdges] = useState<{ groupId: string; periodId: string; active: boolean }[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [rows, setRows] = useState<SelfStudyAttendanceReadRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, SelfStudyAttendanceDraft>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const owner = isSystemOwner(appUser);
  const gradeAdmin = Boolean(appUser && scope?.gradeId && isGradeAdminForGrade(assignments, appUser.uid, scope.academicYearId, scope.gradeId));
  const privileged = owner || gradeAdmin;
  const currentScope = scope?.gradeId ? { academicYearId: scope.academicYearId, gradeId: scope.gradeId } : null;
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;

  useEffect(() => {
    if (!currentScope || !appUser) return;
    let alive = true;
    setLoading(true); setError(null); setRows([]); setDrafts({});
    void Promise.all([
      listScopedPeriods(currentScope.academicYearId, currentScope.gradeId),
      listSupervisionAssignments(currentScope, privileged ? { date } : { date, teacherUid: appUser.uid }),
      listSelfStudyGroups(currentScope),
      listSelfStudyGroupPeriods(currentScope),
    ]).then(([nextPeriods, nextAssignments, nextGroups, nextEdges]) => {
      if (!alive) return;
      setPeriods(nextPeriods); setAllAssignments(nextAssignments); setGroups(nextGroups); setEdges(nextEdges);
    }).catch((caught) => alive && setError(caught instanceof Error ? caught.message : "담당 자습 배정을 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [currentScope?.academicYearId, currentScope?.gradeId, appUser?.uid, date, privileged]);

  const activeAssignments = useMemo(() => allAssignments.filter((assignment) => assignment.active && periods.some((period) => period.active && period.id === assignment.periodId) && groups.some((group) => group.active && group.id === assignment.selfStudyGroupId) && edges.some((edge) => edge.active && edge.groupId === assignment.selfStudyGroupId && edge.periodId === assignment.periodId)), [allAssignments, periods, groups, edges]);
  const availablePeriods = useMemo(() => periods.filter((period) => period.active && isPeriodOperatingOn(date, period) && activeAssignments.some((assignment) => assignment.periodId === period.id)).map((period) => ({ ...period, ...periodScheduleForDate(period, date) })), [date, periods, activeAssignments]);

  useEffect(() => {
    if (!availablePeriods.some((period) => period.id === periodId)) setPeriodId(availablePeriods[0]?.id ?? "");
  }, [availablePeriods, periodId]);

  const availableGroupIds = useMemo(() => {
    if (!periodId || !appUser) return [];
    if (privileged) return [...new Set(activeAssignments.filter((assignment) => assignment.periodId === periodId).map((assignment) => assignment.selfStudyGroupId))];
    return supervisedGroupIdsForTeacher(activeAssignments, appUser.uid, date, periodId);
  }, [activeAssignments, appUser, date, periodId, privileged]);
  const availableGroups = useMemo(() => groups.filter((group) => group.active && availableGroupIds.includes(group.id)), [groups, availableGroupIds]);

  useEffect(() => {
    setGroupId((currentGroupId) => selectInitialSelfStudyGroupId(availableGroups.map((group) => group.id), currentGroupId));
  }, [availableGroups, groupId]);

  useEffect(() => {
    if (!currentScope || !appUser || !periodId || !groupId) { setRows([]); return; }
    let alive = true;
    setLoading(true); setError(null); setRows([]); setDrafts({});
    void listSelfStudyAttendanceReadRows({ ...currentScope, teacherUid: appUser.uid, date, periodId, selfStudyGroupId: groupId, access: { isSystemOwner: owner, isGradeAdmin: gradeAdmin } })
      .then((nextRows) => alive && setRows(nextRows))
      .catch((caught) => alive && setError(caught instanceof Error ? caught.message : "학생 출결 목록을 불러오지 못했습니다."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [currentScope?.academicYearId, currentScope?.gradeId, appUser?.uid, date, periodId, groupId, owner, gradeAdmin]);

  const selectedAssignment = activeAssignments.find((assignment) => assignment.periodId === periodId && assignment.selfStudyGroupId === groupId && assignment.teacherUid === appUser?.uid);
  const editable = privileged || canEditAssignment(selectedAssignment);
  const pendingCount = Object.values(drafts).filter((value) => value !== undefined).length;
  const unenteredCount = countUnenteredSelfStudyAttendance(rows, drafts);
  const summary = useMemo(() => rows.reduce((counts, row) => {
    const status = resolveSelfStudyAttendanceDisplayStatus(row, drafts[row.studentId]);
    if (status === "PRESENT") counts.present += 1;
    else if (status === "EXCUSED_ABSENCE") counts.excused += 1;
    else if (status === "UNEXCUSED_ABSENCE") counts.unexcused += 1;
    else counts.unmarked += 1;
    return counts;
  }, { present: 0, excused: 0, unexcused: 0, unmarked: 0 }), [rows, drafts]);

  function confirmDiscard() {
    return pendingCount === 0 || window.confirm("저장하지 않은 출결 입력이 있습니다. 변경하시겠습니까?");
  }

  function changeDate(nextDate: string) { if (confirmDiscard()) { setDate(nextDate); setNotice(null); } }
  function changePeriod(nextPeriodId: string) { if (confirmDiscard()) { setPeriodId(nextPeriodId); setNotice(null); } }
  function changeGroup(nextGroupId: string) { if (confirmDiscard()) { setGroupId(nextGroupId); setNotice(null); } }

  function chooseAttendance(studentId: string, absenceSelected: boolean) {
    if (!editable || saving) return;
    setDrafts((current) => ({ ...current, [studentId]: absenceSelected }));
    setNotice(null);
  }

  function markAllPresent() {
    if (!editable || saving || rows.length === 0) return;
    const candidates = countUnenteredSelfStudyAttendance(rows, drafts);
    if (candidates === 0) { setNotice("미입력 학생이 없습니다."); return; }
    if (!window.confirm(`미입력 학생 ${candidates}명을 출석으로 저장 대기하시겠습니까? 기존 결석 기록은 변경하지 않습니다.`)) return;
    setDrafts((current) => buildBulkPresentDraft(rows, current));
    setNotice("전체 출석 처리를 저장 대기 목록에 넣었습니다.");
  }

  async function save() {
    if (!currentScope || !actor || !periodId || !groupId || saving || pendingCount === 0) return;
    setSaving(true); setError(null); setNotice(null);
    const remaining = { ...drafts };
    try {
      for (const row of rows) {
        const absenceSelected = remaining[row.studentId];
        if (absenceSelected === undefined) continue;
        await writeSelfStudyAttendance({ ...currentScope, date, periodId, studentId: row.studentId, classId: row.classId, selfStudyGroupId: groupId, absenceSelected, actor, access: { isSystemOwner: owner, isGradeAdmin: gradeAdmin } });
        delete remaining[row.studentId];
        setDrafts({ ...remaining });
      }
      setNotice("출결 저장이 완료되었습니다.");
      const refreshed = await listSelfStudyAttendanceReadRows({ ...currentScope, teacherUid: actor.uid, date, periodId, selfStudyGroupId: groupId, access: { isSystemOwner: owner, isGradeAdmin: gradeAdmin } });
      setRows(refreshed);
    } catch (caught) {
      console.error("[selfStudyAttendanceSave]", caught);
      setDrafts(remaining);
      setError(caught instanceof Error ? `저장에 실패했습니다. ${caught.message}` : "저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하세요.");
      setError(safeLoadError("selfStudyAttendanceSave", caught, "\uCD9C\uACB0\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC120\uD0DD\uD55C \uD559\uB144, \uAD50\uC2DC, \uC790\uC2B5\uADF8\uB8F9 \uBC0F \uC6B4\uC601 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694."));
    } finally { setSaving(false); }
  }

  if (scopeLoading) return <div className="empty-state">불러오는 중...</div>;
  if (!currentScope) return <section className="empty-state"><h2>학년을 선택하세요.</h2><p>자습 출결은 특정 학년 범위에서만 입력할 수 있습니다.</p></section>;

  return <section className="self-study-attendance-page">
    <header className="page-header"><div><div className="eyebrow">자습 출결</div><h2>{privileged ? "관리자 출결 보정" : "담당 자습 출결"}</h2><p className="muted">감독교사가 실제 자습그룹 학생의 출석 여부를 기록하는 화면입니다.</p></div></header>
    <section className="card attendance-controls" aria-label="자습 출결 선택">
      <label>날짜<input type="date" value={date} disabled={saving} onChange={(event) => changeDate(event.target.value)} /></label>
      <label>교시<select value={periodId} disabled={saving || availablePeriods.length === 0} onChange={(event) => changePeriod(event.target.value)}>{availablePeriods.map((period) => <option key={period.id} value={period.id}>{period.name} ({period.startTime}~{period.endTime})</option>)}</select></label>
      <label>자습 그룹<select value={groupId} disabled={saving || availableGroups.length === 0} onChange={(event) => changeGroup(event.target.value)}>{availableGroups.map((group) => <option key={group.id} value={group.id}>{group.displayName}</option>)}</select></label>
    </section>
    {error && <div className="empty-state text-danger">{error}</div>}
    {notice && <div className="empty-state text-success">{notice}</div>}
    {!loading && availablePeriods.length === 0 && <section className="empty-state"><h2>이 날짜에 담당한 자습 운영이 없습니다.</h2><p>배정된 활성 자습 그룹과 교시만 표시됩니다.</p></section>}
    {!loading && periodId && availableGroups.length === 0 && <section className="empty-state"><h2>이 교시에 담당한 자습 그룹이 없습니다.</h2><p>다른 교시를 선택하거나 담당 배정을 확인하세요.</p></section>}
    {periodId && groupId && !editable && !privileged && <div className="empty-state">현재 담당 편집 시간이 아니므로 조회 전용입니다.</div>}
    {periodId && groupId && <section className="attendance-summary card"><div><span className="eyebrow">현재 그룹</span><h3>{availableGroups.find((group) => group.id === groupId)?.displayName}</h3></div><div className="self-study-counts"><span>전체 {rows.length}</span><span>출석 {summary.present}</span><span>인정 결석 {summary.excused}</span><span>무단 결석 {summary.unexcused}</span><span>미입력 {summary.unmarked}</span></div><button type="button" className="secondary" disabled={!editable || saving || rows.length === 0} onClick={markAllPresent}>전체 출석</button></section>}
    <div className="self-study-student-list" aria-live="polite">
      {loading && <div className="empty-state">학생 출결을 불러오는 중...</div>}
      {!loading && rows.map((row) => {
        const status = resolveSelfStudyAttendanceDisplayStatus(row, drafts[row.studentId]);
        return <article className="self-study-student-card" key={row.studentId}>
          <div className="student-card-heading"><div><strong>{row.studentName}</strong><span>{row.classDisplayName}</span></div><span className={`attendance-tag ${statusClass(status)}`}>{status ? SELF_STUDY_ATTENDANCE_LABELS[status] : "미입력"}</span></div>
          {row.hasPermission && <div className="permission-badge">승인 예외: {row.permissionReasonText || row.permissionReasonCode} · {row.permissionPeriodIds?.map((id) => periods.find((period) => period.id === id)?.name ?? id).join(", ")}</div>}
          <div className="attendance-choice" aria-label={`${row.studentName} 출결`}><button type="button" className={status === "PRESENT" ? "active present" : ""} disabled={!editable || saving} onClick={() => chooseAttendance(row.studentId, false)}>출석</button><button type="button" className={status === "EXCUSED_ABSENCE" || status === "UNEXCUSED_ABSENCE" ? "active absent" : ""} disabled={!editable || saving} onClick={() => chooseAttendance(row.studentId, true)}>결석</button></div>
        </article>;
      })}
    </div>
    {!loading && periodId && groupId && rows.length === 0 && <section className="empty-state"><h2>이 그룹에 표시할 활성 학생이 없습니다.</h2><p>학생, 자습 그룹 배정, 그룹 교시 상태를 확인하세요.</p></section>}
    {periodId && groupId && <footer className="self-study-save-bar"><span>{saving ? "저장 중..." : `미입력 ${unenteredCount}명`}</span><button type="button" disabled={!editable || saving || pendingCount === 0} onClick={() => void save()}>{saving ? "저장 중..." : `저장${pendingCount ? ` (${pendingCount})` : ""}`}</button></footer>}
  </section>;
}
