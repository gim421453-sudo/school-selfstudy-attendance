import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { assignHomeroomTeacher, changeHomeroomTeacher, createClass, listClasses, listEligibleHomeroomTeachers, removeHomeroomTeacher, updateClass, type HomeroomCandidate } from "../services/classes";
import { listScopedStudents } from "../services/scopedStudents";
import { useScope } from "../scope/ScopeProvider";
import type { ScopedClassRoom } from "../types/domain";

const actorFor = (uid: string, name: string) => ({ uid, name });

export function ClassesPage() {
  const { appUser } = useAuth();
  const { scope, loading: scopeLoading } = useScope();
  const [classes, setClasses] = useState<ScopedClassRoom[]>([]);
  const [candidates, setCandidates] = useState<HomeroomCandidate[]>([]);
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map());
  const [classNumber, setClassNumber] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const scoped = Boolean(scope?.gradeId);

  async function refresh() {
    if (!scope?.gradeId) return;
    setBusy(true); setMessage(null);
    try {
      const scopedScope = { academicYearId: scope.academicYearId, gradeId: scope.gradeId };
      const [nextClasses, nextCandidates, students] = await Promise.all([
        listClasses(scopedScope.academicYearId, scopedScope.gradeId),
        listEligibleHomeroomTeachers(scopedScope.academicYearId, scopedScope.gradeId),
        listScopedStudents(scopedScope),
      ]);
      setClasses(nextClasses); setCandidates(nextCandidates);
      setStudentCounts(students.reduce((counts, student) => counts.set(student.classId, (counts.get(student.classId) ?? 0) + 1), new Map<string, number>()));
    } catch (error) { setMessage(error instanceof Error ? error.message : "반 정보를 불러오지 못했습니다."); }
    finally { setBusy(false); }
  }

  useEffect(() => { void refresh(); }, [scope?.academicYearId, scope?.gradeId]);

  const candidateByUid = useMemo(() => new Map(candidates.map((candidate) => [candidate.uid, candidate])), [candidates]);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!appUser || !scope?.gradeId) return;
    setBusy(true); setMessage(null);
    try {
      await createClass({ academicYearId: scope.academicYearId, gradeId: scope.gradeId, classNumber, displayName: displayName.trim() || `${classNumber}반`, active: true }, actorFor(appUser.uid, appUser.displayName));
      setDisplayName(""); await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "반을 만들지 못했습니다."); setBusy(false); }
  }

  async function saveClass(classRoom: ScopedClassRoom, values: Partial<Pick<ScopedClassRoom, "displayName" | "active">>) {
    if (!appUser) return;
    if (values.active === false && !confirm("반을 비활성화해도 기존 학생 및 출결 기록은 삭제되지 않습니다. 계속하시겠습니까?")) return;
    setBusy(true); setMessage(null);
    try { await updateClass({ ...classRoom, ...values }, actorFor(appUser.uid, appUser.displayName), classRoom); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "반 정보를 저장하지 못했습니다."); setBusy(false); }
  }

  async function setHomeroom(classRoom: ScopedClassRoom, teacherUid: string) {
    if (!appUser) return;
    const actor = actorFor(appUser.uid, appUser.displayName);
    setBusy(true); setMessage(null);
    try {
      if (!teacherUid) await removeHomeroomTeacher(classRoom.id, actor);
      else if (classRoom.homeroomTeacherUid) await changeHomeroomTeacher(classRoom.id, teacherUid, actor);
      else await assignHomeroomTeacher(classRoom.id, teacherUid, actor);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "담임을 변경하지 못했습니다."); setBusy(false); }
  }

  if (scopeLoading) return <div className="empty-state"><p>반 정보를 불러오는 중...</p></div>;
  if (!scoped) return <section className="empty-state"><h2>학년을 선택하세요.</h2><p>전체 학년 범위에서는 반을 관리할 수 없습니다.</p></section>;

  return <>
    <header className="page-header"><div><div className="eyebrow">CLASS / HOMEROOM</div><h2>학급 / 담임 관리</h2><p className="muted">학생이 실제 수업을 듣는 학교 학급과 담임교사를 관리합니다. 자습반·정독실 등 자습 운영 그룹과는 별개의 정보입니다.</p></div></header>
    {message && <div className="empty-state"><p className="text-danger">{message}</p></div>}
    <div className="grid two">
      <form className="card" onSubmit={(event) => void create(event)}>
        <h3>반 추가</h3>
        <label>반 번호<input type="number" min={1} value={classNumber} onChange={(event) => setClassNumber(Number(event.target.value))} disabled={busy} /></label>
        <label>표시명<input value={displayName} placeholder={`${classNumber}반`} onChange={(event) => setDisplayName(event.target.value)} disabled={busy} /></label>
        <button className="primary" disabled={busy}>반 만들기</button>
      </form>
      <section className="card"><h3>운영 안내</h3><p>반을 비활성화해도 기존 학생 및 출결 기록은 삭제되지 않습니다.</p><p className="muted">담임 후보는 현재 학년도·학년의 활성 교직원 배정만 사용합니다.</p></section>
    </div>
    <section className="card">
      <h3>반 목록</h3>
      {busy && <p className="muted">불러오는 중...</p>}
      {!busy && classes.length === 0 ? <div className="empty-state"><p>등록된 반이 없습니다.</p></div> : <div className="table-wrap"><table><thead><tr><th>반</th><th>표시명</th><th>담임</th><th>학생 수</th><th>상태</th><th>관리</th></tr></thead><tbody>{classes.map((classRoom) => {
        const currentCandidate = classRoom.homeroomTeacherUid ? candidateByUid.get(classRoom.homeroomTeacherUid) : null;
        return <tr key={classRoom.id}><td>{classRoom.classNumber}반</td><td><input defaultValue={classRoom.displayName} onBlur={(event) => event.target.value.trim() !== classRoom.displayName && void saveClass(classRoom, { displayName: event.target.value })} disabled={busy} /></td><td><select value={classRoom.homeroomTeacherUid ?? ""} onChange={(event) => void setHomeroom(classRoom, event.target.value)} disabled={busy || !classRoom.active}><option value="">담임 미배정</option>{candidates.map((candidate) => <option key={candidate.uid} value={candidate.uid} disabled={Boolean(candidate.conflictClassId && candidate.conflictClassId !== classRoom.id)}>{candidate.displayName}{candidate.conflictClassId && candidate.conflictClassId !== classRoom.id ? ` (이미 ${candidate.conflictClassName} 담임)` : ""}</option>)}</select>{currentCandidate?.conflictClassId && currentCandidate.conflictClassId !== classRoom.id && <span className="text-danger">담임 중복 확인 필요</span>}</td><td>{studentCounts.get(classRoom.id) ?? 0}명</td><td>{classRoom.active ? "활성" : "비활성"}</td><td><button type="button" onClick={() => void saveClass(classRoom, { active: !classRoom.active })} disabled={busy}>{classRoom.active ? "비활성화" : "활성화"}</button></td></tr>;
      })}</tbody></table></div>}
    </section>
  </>;
}
