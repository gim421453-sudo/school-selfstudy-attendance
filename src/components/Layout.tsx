import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { canViewStats, isGradeAdmin, isOwner } from "../domain/access";
import { useEffect, useState } from "react";
import { getAccessSettings } from "../services/settings";
import type { AccessSettings } from "../types/domain";

export function Layout() {
  const { appUser, logout } = useAuth();
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  useEffect(() => { void getAccessSettings().then(setSettings); }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark">SA</div>
          <h1>자습 출결관리</h1>
          <p className="muted">{"\uD559\uAD50 \uC790\uC728\uD559\uC2B5 \uCD9C\uACB0"}</p>
        </div>

        <nav>
          <NavLink to="/">대시보드</NavLink>
          <NavLink to="/attendance">출결 관리</NavLink>
          <NavLink to="/history">이전 출결</NavLink>
          <NavLink to="/duty">담당교사 일정</NavLink>
          {isGradeAdmin(appUser) && <NavLink to="/students">학생 명부</NavLink>}
          {isGradeAdmin(appUser) && <NavLink to="/classes">반·담임 관리</NavLink>}
          {isGradeAdmin(appUser) && <NavLink to="/periods">교시 관리</NavLink>}
          {settings && canViewStats(appUser, settings) && <NavLink to="/stats">통계</NavLink>}
          {isOwner(appUser) && <NavLink to="/admin">최고관리자</NavLink>}
        </nav>

        <div className="profile-box">
          <strong>{appUser?.displayName}</strong>
          <span>{appUser?.homeroomClassId ? `담임 ${appUser.homeroomClassId}` : appUser?.roles.join(", ")}</span>
          <span>{appUser?.email}</span>
          <button className="ghost" onClick={() => void logout()}>로그아웃</button>
        </div>
      </aside>
      <main className="content"><Outlet /></main>
    </div>
  );
}
