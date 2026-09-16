import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { canViewStats } from "../domain/access";
import { isSystemOwner } from "../domain/scope";
import { visibleNavigation } from "../navigation";
import { getOperationsSettings } from "../services/operations";
import { getAccessSettings } from "../services/settings";
import { useScope } from "../scope/ScopeProvider";
import type { AccessSettings, OperationsSettings } from "../types/domain";

export function Layout() {
  const { appUser, logout } = useAuth();
  const { scope, loading, error, selectableYears, selectableGrades, grades, assignments, setScope } = useScope();
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [operations, setOperations] = useState<OperationsSettings | null>(null);
  useEffect(() => { void getAccessSettings().then(setSettings); }, []);
  useEffect(() => { void getOperationsSettings().then(setOperations).catch(() => setOperations(null)); }, []);
  const owner = isSystemOwner(appUser);
  const menu = visibleNavigation(appUser, assignments, scope).filter((item) => item.to !== "/stats" || (settings && canViewStats(appUser, settings)));
  const blockedMessage = !owner && operations?.emergencyMode === "MAINTENANCE" ? "시스템 점검 중입니다." : !owner && operations?.emergencyMode === "LOCKDOWN" ? "현재 시스템 이용이 제한되어 있습니다." : null;

  return <div className="app-shell">
    <aside className="sidebar">
      <div><div className="brand-mark">SA</div><h1>자습 출결관리</h1><p className="muted">학교 자율학습 출결</p></div>
      <nav>{menu.map((item) => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}</nav>
      <div className="profile-box"><strong>{appUser?.displayName}</strong><span>{appUser?.email}</span><button className="ghost" onClick={() => void logout()}>로그아웃</button></div>
    </aside>
    <main className="content">
      {loading ? <div className="center-page">학년도 및 학년 권한을 확인하는 중...</div> : error || !scope ? <div className="empty-state"><h2>사용 가능한 학년 범위가 없습니다.</h2><p>{error ?? "현재 학년도에 배정된 학년이 없습니다."}</p></div> : <>
        <header className="scope-header"><div><span className="eyebrow">현재 범위</span><strong>{selectableYears.find((year) => year.id === scope.academicYearId)?.displayName ?? scope.academicYearId} &gt; {scope.gradeId === null ? "전체 학년" : selectableGrades.find((grade) => grade.id === scope.gradeId)?.displayName ?? scope.gradeId}</strong></div>
        <div className="scope-controls"><select value={scope.academicYearId} onChange={(event) => { const yearId = event.target.value; const firstGrade = grades.find((grade) => grade.academicYearId === yearId && (owner || assignments.some((assignment) => assignment.active && assignment.academicYearId === yearId && assignment.gradeId === grade.id))); setScope({ academicYearId: yearId, gradeId: owner ? null : firstGrade?.id ?? "" }); }}>{selectableYears.map((year) => <option key={year.id} value={year.id}>{year.displayName}</option>)}</select>
        <select value={scope.gradeId ?? ""} onChange={(event) => setScope({ academicYearId: scope.academicYearId, gradeId: event.target.value || null })}>{owner && <option value="">전체 학년</option>}{selectableGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.displayName}</option>)}</select></div></header>
        {blockedMessage ? <div className="empty-state"><h2>{blockedMessage}</h2><p>{operations?.maintenance.message || operations?.emergencyMessage}</p></div> : <Outlet />}
      </>}
    </main>
  </div>;
}
