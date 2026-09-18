import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { canViewStats } from "../domain/access";
import { getOperationsPhase, maintenanceNoticeKey } from "../domain/operationsState";
import { isSystemOwner, scopeBootstrapView } from "../domain/scope";
import { visibleNavigation } from "../navigation";
import { getOperationsSettings } from "../services/operations";
import { getAccessSettings } from "../services/settings";
import { useScope } from "../scope/ScopeProvider";
import type { AccessSettings, OperationsSettings } from "../types/domain";

const compactQuery = "(max-width: 900px)";
const operationModeLabels: Record<OperationsSettings["emergencyMode"], string> = { NORMAL: "정상 운영", READ_ONLY: "읽기 전용", ESSENTIAL_ONLY: "필수 기능만 운영", MAINTENANCE: "시스템 점검", LOCKDOWN: "전체 접근 제한" };

export function Layout() {
  const { appUser, logout } = useAuth();
  const { scope, loading, error, selectableYears, selectableGrades, grades, assignments, setScope } = useScope();
  const location = useLocation();
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [operations, setOperations] = useState<OperationsSettings | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { void getAccessSettings().then(setSettings); void getOperationsSettings().then(setOperations).catch(() => setOperations(null)); }, []);
  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    const sync = () => { setCompact(media.matches); if (!media.matches) setSidebarOpen(false); };
    sync(); media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!compact || !sidebarOpen) return;
    closeButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [compact, sidebarOpen]);

  const owner = isSystemOwner(appUser);
  const phase = getOperationsPhase(operations);
  const noticeKey = operations ? maintenanceNoticeKey(operations) : "";
  useEffect(() => { setDismissed(localStorage.getItem(`operations-notice:${noticeKey}`) === "1"); }, [noticeKey]);
  const menu = visibleNavigation(appUser, assignments, scope).filter((item) => item.to !== "/stats" || (settings && canViewStats(appUser, settings)));
  const scheduled = operations?.maintenance;
  const maintenance = phase === "maintenance" && !owner;
  const lockdown = phase === "lockdown" && !owner;
  const bootstrapView = (lockdown || maintenance) ? "ready" : scopeBootstrapView(loading, error, scope);
  const activeScope = scope ?? { academicYearId: "", gradeId: null };

  if (bootstrapView === "loading" && !lockdown) return <div className="center-page">{"\uD559\uB144\uB3C4\uC640 \uD559\uB144 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uB294 \uC911..."}</div>;
  return <div className="app-shell">
    {compact && sidebarOpen && <button type="button" className="sidebar-backdrop" aria-label={"\uC0AC\uC774\uB4DC\uBC14 \uB2EB\uAE30"} onClick={() => setSidebarOpen(false)} />}
    {compact && <button type="button" className="mobile-menu-toggle" aria-label={"\uBA54\uB274 \uC5F4\uAE30"} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)}>{"\u2630"}</button>}
    <aside className={`sidebar ${compact ? "sidebar-drawer" : ""} ${compact && sidebarOpen ? "sidebar-open" : ""}`} aria-hidden={compact && !sidebarOpen}>
      <div className="sidebar-top">
        <div><div className="brand-mark">SA</div><h1>{"\uC790\uC2B5 \uCD9C\uACB0"}</h1><p className="muted">{"\uD559\uAD50 \uC790\uC728\uD559\uC2B5 \uC6B4\uC601"}</p></div>
        <button ref={closeButton} type="button" className="sidebar-close" aria-label={"\uC0AC\uC774\uB4DC\uBC14 \uB2EB\uAE30"} onClick={() => setSidebarOpen(false)}>{"\u00D7"}</button>
      </div>
      <nav>{menu.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setSidebarOpen(false)}>{item.label}</NavLink>)}</nav>
      {operations && <div className="profile-box"><span className="muted">시스템 운영 상태</span><strong className="badge">{operationModeLabels[operations.emergencyMode]}</strong></div>}
      <div className="profile-box"><strong>{appUser?.displayName}</strong><span>{appUser?.email}</span><button className="ghost" onClick={() => void logout()}>{"\uB85C\uADF8\uC544\uC6C3"}</button></div>
    </aside>
    <main className="content">
      {lockdown ? <section className="empty-state"><h2>{"\uD604\uC7AC \uC2DC\uC2A4\uD15C \uC774\uC6A9\uC774 \uC81C\uD55C\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."}</h2><p>{operations?.emergencyMessage}</p></section> : bootstrapView === "error" ? <div className="empty-state text-danger"><h2>{"\uBC94\uC704 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."}</h2><p>{"\uD559\uB144\uB3C4\uC640 \uD559\uB144 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."}</p></div> : bootstrapView === "missing" ? <div className="empty-state"><h2>{"\uD559\uB144\uB3C4 \uB610\uB294 \uD559\uB144 \uC815\uBCF4\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4."}</h2></div> : <>
        <header className="scope-header"><div><span className="eyebrow">{"\uD604\uC7AC \uBC94\uC704"}</span><strong>{selectableYears.find((year) => year.id === activeScope.academicYearId)?.displayName ?? activeScope.academicYearId} &gt; {activeScope.gradeId === null ? "\uC804\uCCB4 \uD559\uB144" : selectableGrades.find((grade) => grade.id === activeScope.gradeId)?.displayName ?? activeScope.gradeId}</strong></div><div className="scope-controls"><select value={activeScope.academicYearId} onChange={(event) => { const id = event.target.value; const grade = grades.find((item) => item.academicYearId === id && (owner || assignments.some((assignment) => assignment.active && assignment.academicYearId === id && assignment.gradeId === item.id))); setScope({ academicYearId: id, gradeId: owner ? null : grade?.id ?? "" }); }}>{selectableYears.map((year) => <option key={year.id} value={year.id}>{year.displayName}</option>)}</select><select value={activeScope.gradeId ?? ""} onChange={(event) => setScope({ academicYearId: activeScope.academicYearId, gradeId: event.target.value || null })}>{owner && <option value="">{"\uC804\uCCB4 \uD559\uB144"}</option>}{selectableGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.displayName}</option>)}</select></div></header>
        {phase === "read_only" && !owner && <div className="empty-state">{"\uD604\uC7AC \uC2DC\uC2A4\uD15C\uC740 \uC870\uD68C \uC804\uC6A9 \uC0C1\uD0DC\uC785\uB2C8\uB2E4."}</div>}
        {phase === "essential" && !owner && <div className="empty-state">{"\uC790\uC2B5 \uC6B4\uC601 \uC911 - \uD544\uC218 \uCD9C\uACB0 \uAE30\uB2A5\uB9CC \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}</div>}
        {phase === "notice" && !owner && scheduled?.bannerEnabled && <div className="empty-state"><strong>{scheduled.title}</strong><p>{scheduled.message}</p></div>}
        {phase === "notice" && !owner && scheduled?.popupEnabled && !dismissed && <section className="card"><h2>{scheduled.title}</h2><p>{scheduled.message}</p><button onClick={() => { localStorage.setItem(`operations-notice:${noticeKey}`, "1"); setDismissed(true); }}>{"\uD655\uC778"}</button></section>}
        {maintenance ? <section className="empty-state"><h2>{"\uC2DC\uC2A4\uD15C \uC810\uAC80 \uC911\uC785\uB2C8\uB2E4."}</h2><p>{scheduled?.title} {scheduled?.message}</p></section> : lockdown ? <section className="empty-state"><h2>{"\uD604\uC7AC \uC2DC\uC2A4\uD15C \uC774\uC6A9\uC774 \uC81C\uD55C\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4."}</h2><p>{operations?.emergencyMessage}</p></section> : <Outlet />}
      </>}
    </main>
  </div>;
}
