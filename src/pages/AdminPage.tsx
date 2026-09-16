import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getAccessSettings, saveAccessSettings } from "../services/settings";
import { listUsers, updateUserAccount } from "../services/users";
import { approvePendingUser, listPendingUsers, rejectPendingUser } from "../services/pendingUsers";
import { createAcademicYear, listAcademicYears, setCurrentAcademicYear, updateAcademicYear } from "../services/academicYears";
import { createGrade, listGrades, updateGrade } from "../services/grades";
import type { AccessSettings, AcademicYear, AppUser, Grade, PendingUser, UserRole } from "../types/domain";

export function AdminPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [search, setSearch] = useState("");
  const [years, setYears] = useState<AcademicYear[]>([]); const [grades, setGrades] = useState<Grade[]>([]);
  const [yearId, setYearId] = useState(""); const [yearName, setYearName] = useState(""); const [gradeNo, setGradeNo] = useState(1); const [gradeName, setGradeName] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;
  async function refreshUsers() { setUsers(await listUsers()); }
  async function refreshPending() { setPendingUsers(await listPendingUsers()); }
  useEffect(() => { void refreshUsers(); void refreshPending(); void getAccessSettings().then(setSettings); }, []);
  async function refreshYears() { const next = await listAcademicYears(); setYears(next); const selected = yearId || next.find((year) => year.isCurrent)?.id || next[0]?.id || ""; setYearId(selected); if (selected) setGrades(await listGrades(selected)); }
  useEffect(() => { void refreshYears(); }, []);
  async function saveYear() { if (!actor) return; setBusy(true); setError(""); try { await createAcademicYear({ id: yearId, displayName: yearName || yearId, active: true, isCurrent: false }, actor); setYearName(""); await refreshYears(); } catch (value) { setError(value instanceof Error ? value.message : "학년도를 저장하지 못했습니다."); } finally { setBusy(false); } }
  async function makeCurrent(year: AcademicYear) { if (!actor || !confirm(`현재 학년도를 ${year.displayName}로 변경하시겠습니까?`)) return; setBusy(true); try { await setCurrentAcademicYear(year.id, actor); await refreshYears(); } finally { setBusy(false); } }
  async function saveGrade() { if (!actor || !yearId) return; setBusy(true); setError(""); try { await createGrade({ academicYearId: yearId, gradeNumber: gradeNo, displayName: gradeName || `${gradeNo}학년`, active: true }, actor); setGradeName(""); await refreshYears(); } catch (value) { setError(value instanceof Error ? value.message : "학년을 저장하지 못했습니다."); } finally { setBusy(false); } }
  async function toggleGrade(grade: Grade) { if (!actor) return; await updateGrade({ ...grade, active: !grade.active }, actor, grade); await refreshYears(); }
  async function toggleStats() {
    if (!settings || !actor) return;
    const next = { ...settings, statsVisibility: settings.statsVisibility === "grade_admin_only" ? "grade_admin_and_homeroom" : "grade_admin_only" } as AccessSettings;
    await saveAccessSettings(next, actor, settings);
    setSettings(next);
  }
  async function setActive(user: AppUser) {
    if (!actor) return;
    await updateUserAccount(user, { active: !user.active }, actor);
    await refreshUsers();
  }
  async function setBaseRole(user: AppUser, mode: "teacher" | "grade_admin") {
    if (!actor) return;
    const preserved = user.roles.filter((role) => role === "system_owner" || role === "homeroom_teacher");
    const roles: UserRole[] = [...preserved, "teacher", ...(mode === "grade_admin" ? ["grade_admin"] as UserRole[] : [])];
    await updateUserAccount(user, { roles }, actor);
    await refreshUsers();
  }
  async function approve(pending: PendingUser) { if (!actor) return; await approvePendingUser(pending, actor); await Promise.all([refreshUsers(), refreshPending()]); }
  async function reject(pending: PendingUser) { if (!actor) return; await rejectPendingUser(pending, actor); await refreshPending(); }
  const visible = useMemo(() => users.filter((user) => `${user.displayName} ${user.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  return <><header className="page-header"><div><div className="eyebrow">{"\uCD5C\uACE0 \uAD00\uB9AC\uC790"}</div><h2>전체 관리</h2></div></header>
    <div className="grid three"><section className="card"><h3>학년도 관리</h3><p>학년도와 현재 학년도를 관리합니다.</p></section><section className="card"><h3>학년 관리</h3><p>선택한 학년도의 학년을 관리합니다.</p></section><section className="card"><h3>교직원 배정</h3><p>다음 단계에서 제공합니다.</p></section></div>
    <section className="card"><div className="section-title-row"><h3>학년도 관리</h3>{error && <span className="text-danger">{error}</span>}</div><div className="toolbar"><label>학년도 ID<input value={yearId} onChange={(event) => setYearId(event.target.value)} /></label><label>표시명<input value={yearName} onChange={(event) => setYearName(event.target.value)} placeholder="예: 2027학년도" /></label><button disabled={busy} onClick={() => void saveYear()}>새 학년도 추가</button></div><div className="table-wrap"><table><thead><tr><th>학년도</th><th>표시명</th><th>상태</th><th>현재 학년도</th><th /></tr></thead><tbody>{years.map((year) => <tr key={year.id}><td>{year.id}</td><td>{year.displayName}</td><td>{year.active ? "활성" : "비활성"}</td><td>{year.isCurrent ? "현재" : "-"}</td><td>{!year.isCurrent && <button className="small" disabled={busy || !year.active} onClick={() => void makeCurrent(year)}>현재 학년도로 변경</button>}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="section-title-row"><h3>학년 관리</h3><select value={yearId} onChange={(event) => { setYearId(event.target.value); void listGrades(event.target.value).then(setGrades); }}>{years.map((year) => <option key={year.id} value={year.id}>{year.displayName}</option>)}</select></div><div className="toolbar"><label>학년 번호<input type="number" min={1} value={gradeNo} onChange={(event) => setGradeNo(Number(event.target.value))} /></label><label>표시명<input value={gradeName} onChange={(event) => setGradeName(event.target.value)} placeholder={`${gradeNo}학년`} /></label><button disabled={busy || !yearId} onClick={() => void saveGrade()}>학년 추가</button></div><div className="table-wrap"><table><thead><tr><th>학년</th><th>표시명</th><th>상태</th><th /></tr></thead><tbody>{grades.map((grade) => <tr key={grade.id}><td>{grade.gradeNumber}학년</td><td>{grade.displayName}</td><td>{grade.active ? "활성" : "비활성"}</td><td><button className="small" onClick={() => void toggleGrade(grade)}>{grade.active ? "비활성화" : "활성화"}</button></td></tr>)}</tbody></table></div></section>
    <div className="grid two"><section className="card"><h3>{"\uD1B5\uACC4 \uC5F4\uB78C \uAD8C\uD55C"}</h3><p><strong>{settings?.statsVisibility ?? "\uBD88\uB7EC\uC624\uB294 \uC911"}</strong></p><button onClick={() => void toggleStats()}>{"\uC815\uCC45 \uBCC0\uACBD"}</button></section><section className="card"><h3>{"\uAD50\uC9C1\uC6D0 \uACC4\uC815"}</h3><label>{"\uAC80\uC0C9"}<input value={search} onChange={(event) => setSearch(event.target.value)} /></label></section></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>{"\uC774\uB984"}</th><th>{"\uC774\uBA54\uC77C"}</th><th>{"\uC0C1\uD0DC"}</th><th>{"\uC5ED\uD560"}</th><th>{"\uB2F4\uC784"}</th><th>{"\uC791\uC5C5"}</th></tr></thead><tbody>{visible.map((user) => <tr key={user.uid}><td>{user.displayName}</td><td>{user.email}</td><td>{user.active ? "\uD65C\uC131" : "\uBE44\uD65C\uC131"}</td><td>{user.roles.join(", ")}</td><td>{user.homeroomClassId ?? "-"}</td><td>{user.roles.includes("system_owner") ? "-" : <><select value={user.roles.includes("grade_admin") ? "grade_admin" : "teacher"} onChange={(event) => void setBaseRole(user, event.target.value as "teacher" | "grade_admin")}><option value="teacher">{"\uAD50\uC0AC"}</option><option value="grade_admin">{"\uD559\uB144\uBD80 \uAD00\uB9AC\uC790"}</option></select><button className="small" onClick={() => void setActive(user)}>{user.active ? "\uBE44\uD65C\uC131\uD654" : "\uD65C\uC131\uD654"}</button></>}</td></tr>)}</tbody></table></div></section>
    <section className="card"><h3>{"\uC2B9\uC778 \uB300\uAE30 \uC0AC\uC6A9\uC790"}</h3><p className="muted">승인 후 학년도와 학년 배정이 필요합니다.</p><div className="table-wrap"><table><thead><tr><th>{"\uC774\uB984"}</th><th>{"\uC774\uBA54\uC77C"}</th><th>{"\uC2B9\uC778 \uC694\uCCAD"}</th><th>{"\uCD5C\uADFC \uB85C\uADF8\uC778"}</th><th>{"\uC791\uC5C5"}</th></tr></thead><tbody>{pendingUsers.map((pending) => <tr key={pending.uid}><td>{pending.displayName}</td><td>{pending.email}</td><td>{pending.createdAt && "toDate" in (pending.createdAt as object) ? (pending.createdAt as { toDate(): Date }).toDate().toLocaleString("ko-KR") : "-"}</td><td>{pending.lastLoginAt && "toDate" in (pending.lastLoginAt as object) ? (pending.lastLoginAt as { toDate(): Date }).toDate().toLocaleString("ko-KR") : "-"}</td><td><button className="small" onClick={() => void approve(pending)}>승인</button><button className="small" onClick={() => void reject(pending)}>{"\uC694\uCCAD \uAC70\uC808"}</button></td></tr>)}</tbody></table></div></section>
  </>;
}
