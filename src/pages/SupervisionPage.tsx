import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { listScopedPeriods, type ScopedPeriod } from "../services/scopedPeriods";
import { listAssignmentsForGrade } from "../services/staffAssignments";
import { deactivateSupervisionAssignment, listSelfStudyGroupPeriods, listSelfStudyGroups, listSupervisionAssignments, saveSupervisionAssignment } from "../services/selfStudyOperations";
import { useScope } from "../scope/ScopeProvider";
import type { SelfStudyGroup, SelfStudyGroupPeriod, StaffAssignment, SupervisionAssignment } from "../types/domain";

type SupervisionRow = { period: ScopedPeriod; group: SelfStudyGroup; assignments: SupervisionAssignment[] };

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function SupervisionPage() {
  const { appUser } = useAuth();
  const { scope, loading: scopeLoading } = useScope();
  const [date, setDate] = useState(localDate());
  const [groups, setGroups] = useState<SelfStudyGroup[]>([]);
  const [groupPeriods, setGroupPeriods] = useState<SelfStudyGroupPeriod[]>([]);
  const [periods, setPeriods] = useState<ScopedPeriod[]>([]);
  const [candidates, setCandidates] = useState<StaffAssignment[]>([]);
  const [assignments, setAssignments] = useState<SupervisionAssignment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;

  async function refresh() {
    if (!scope?.gradeId) return;
    setBusy(true); setError(null);
    try {
      const currentScope = { academicYearId: scope.academicYearId, gradeId: scope.gradeId };
      const [nextGroups, nextGroupPeriods, nextPeriods, nextCandidates, nextAssignments] = await Promise.all([
        listSelfStudyGroups(currentScope), listSelfStudyGroupPeriods(currentScope), listScopedPeriods(currentScope.academicYearId, currentScope.gradeId), listAssignmentsForGrade(currentScope.academicYearId, currentScope.gradeId), listSupervisionAssignments(currentScope, { date }),
      ]);
      setGroups(nextGroups); setGroupPeriods(nextGroupPeriods); setPeriods(nextPeriods); setCandidates(nextCandidates); setAssignments(nextAssignments);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "감독 배정 정보를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, [scope?.academicYearId, scope?.gradeId, date]);

  const rows = useMemo<SupervisionRow[]>(() => {
    const activeGroups = new Map(groups.filter((group) => group.active).map((group) => [group.id, group]));
    const activePeriods = new Map(periods.filter((period) => period.active).map((period) => [period.id, period]));
    return groupPeriods.filter((edge) => edge.active && activeGroups.has(edge.groupId) && activePeriods.has(edge.periodId))
      .map((edge) => ({ period: activePeriods.get(edge.periodId)!, group: activeGroups.get(edge.groupId)!, assignments: assignments.filter((assignment) => assignment.active && assignment.periodId === edge.periodId && assignment.selfStudyGroupId === edge.groupId) }))
      .sort((left, right) => left.period.order - right.period.order || left.group.sortOrder - right.group.sortOrder);
  }, [assignments, groupPeriods, groups, periods]);
  const activeCandidates = useMemo(() => candidates.filter((candidate) => candidate.active && (candidate.role === "teacher" || candidate.role === "grade_admin")), [candidates]);

  async function addSupervisor(row: SupervisionRow, teacherUid: string) {
    if (!scope?.gradeId || !actor || !teacherUid) return;
    const candidate = activeCandidates.find((item) => item.uid === teacherUid);
    if (!candidate) return;
    try {
      await saveSupervisionAssignment({ academicYearId: scope.academicYearId, gradeId: scope.gradeId, date, periodId: row.period.id, selfStudyGroupId: row.group.id, teacherUid: candidate.uid, teacherDisplayName: candidate.displayName || "이름 정보 없음", active: true }, actor, assignments.find((assignment) => assignment.periodId === row.period.id && assignment.selfStudyGroupId === row.group.id && assignment.teacherUid === candidate.uid) ?? null);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "감독교사를 배정하지 못했습니다."); }
  }

  async function removeSupervisor(assignment: SupervisionAssignment) {
    if (!actor || !confirm(`${assignment.teacherDisplayName} 선생님의 감독 배정을 해제할까요?`)) return;
    try { await deactivateSupervisionAssignment(assignment, actor); await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "감독교사 배정을 해제하지 못했습니다."); }
  }

  if (scopeLoading) return <div className="empty-state">불러오는 중...</div>;
  if (!scope?.gradeId) return <section className="empty-state"><h2>학년을 선택하세요.</h2><p>감독교사 배정은 특정 학년 범위에서만 관리할 수 있습니다.</p></section>;
  return <>
    <header className="page-header"><div><div className="eyebrow">자습 감독 관리</div><h2>감독교사 배정</h2><p className="muted">{scope.academicYearId}학년도 · {scope.gradeId}</p></div><label>날짜<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>
    {error && <div className="empty-state text-danger">{error}</div>}
    <section className="card"><h3>교시별 자습 그룹 감독</h3><p className="muted">활성 자습 그룹과 활성 교시의 운영 연결만 표시합니다. 한 교사에게 여러 그룹을, 한 그룹에 여러 감독교사를 배정할 수 있습니다.</p>
      {busy ? <div className="empty-state">불러오는 중...</div> : rows.length === 0 ? <div className="empty-state">선택한 날짜에 배정할 활성 자습 그룹·교시 연결이 없습니다.</div> : <div className="table-wrap"><table><thead><tr><th>교시</th><th>자습 그룹</th><th>배정된 감독교사</th><th>감독교사 추가</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.period.id}_${row.group.id}`}><td>{row.period.name}<br /><span className="muted">{row.period.startTime} - {row.period.endTime}</span></td><td>{row.group.displayName}</td><td>{row.assignments.length === 0 ? <span className="muted">미배정</span> : row.assignments.map((assignment) => <button key={assignment.id} type="button" title="감독 배정 해제" onClick={() => void removeSupervisor(assignment)}>{assignment.teacherDisplayName} ×</button>)}</td><td><select defaultValue="" disabled={activeCandidates.length === 0} onChange={(event) => { void addSupervisor(row, event.target.value); event.currentTarget.value = ""; }}><option value="">{activeCandidates.length === 0 ? "활성 배정 교직원 없음" : "감독교사 선택"}</option>{activeCandidates.filter((candidate) => !row.assignments.some((assignment) => assignment.teacherUid === candidate.uid)).map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.displayName || "이름 정보 없음"} ({candidate.role === "grade_admin" ? "학년부" : "일반교사"})</option>)}</select></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
