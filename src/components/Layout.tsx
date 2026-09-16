import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { canViewStats } from "../domain/access";
import { getOperationsPhase, maintenanceNoticeKey } from "../domain/operationsState";
import { isSystemOwner } from "../domain/scope";
import { visibleNavigation } from "../navigation";
import { getOperationsSettings } from "../services/operations";
import { getAccessSettings } from "../services/settings";
import { useScope } from "../scope/ScopeProvider";
import type { AccessSettings, OperationsSettings } from "../types/domain";

export function Layout() {
  const { appUser, logout } = useAuth(); const { scope, loading, error, selectableYears, selectableGrades, grades, assignments, setScope } = useScope();
  const [settings,setSettings]=useState<AccessSettings|null>(null); const [operations,setOperations]=useState<OperationsSettings|null>(null); const [dismissed,setDismissed]=useState(false);
  useEffect(()=>{void getAccessSettings().then(setSettings);void getOperationsSettings().then(setOperations).catch(()=>setOperations(null));},[]);
  const owner=isSystemOwner(appUser); const phase=getOperationsPhase(operations); const noticeKey=operations?maintenanceNoticeKey(operations):"";
  useEffect(()=>{setDismissed(localStorage.getItem(`operations-notice:${noticeKey}`)==="1");},[noticeKey]);
  const menu=visibleNavigation(appUser,assignments,scope).filter((item)=>item.to!=="/stats"||(settings&&canViewStats(appUser,settings)));
  const scheduled=operations?.maintenance; const maintenance=phase==="maintenance"&&!owner; const lockdown=phase==="lockdown"&&!owner;
  if(loading)return <div className="center-page">학년도와 학년 정보를 확인하는 중...</div>;
  return <div className="app-shell"><aside className="sidebar"><div><div className="brand-mark">SA</div><h1>자습 출결</h1><p className="muted">학교 자율학습 운영</p></div><nav>{menu.map((item)=><NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}</nav><div className="profile-box"><strong>{appUser?.displayName}</strong><span>{appUser?.email}</span><button className="ghost" onClick={()=>void logout()}>로그아웃</button></div></aside><main className="content">{error||!scope?<div className="empty-state"><h2>학년도 또는 학년 정보가 필요합니다.</h2></div>:<><header className="scope-header"><div><span className="eyebrow">현재 범위</span><strong>{selectableYears.find((year)=>year.id===scope.academicYearId)?.displayName??scope.academicYearId} &gt; {scope.gradeId===null?"전체 학년":selectableGrades.find((grade)=>grade.id===scope.gradeId)?.displayName??scope.gradeId}</strong></div><div className="scope-controls"><select value={scope.academicYearId} onChange={(e)=>{const id=e.target.value;const grade=grades.find((g)=>g.academicYearId===id&&(owner||assignments.some((a)=>a.active&&a.academicYearId===id&&a.gradeId===g.id)));setScope({academicYearId:id,gradeId:owner?null:grade?.id??""});}}>{selectableYears.map((year)=><option key={year.id} value={year.id}>{year.displayName}</option>)}</select><select value={scope.gradeId??""} onChange={(e)=>setScope({academicYearId:scope.academicYearId,gradeId:e.target.value||null})}>{owner&&<option value="">전체 학년</option>}{selectableGrades.map((grade)=><option key={grade.id} value={grade.id}>{grade.displayName}</option>)}</select></div></header>{phase==="read_only"&&!owner&&<div className="empty-state">현재 시스템은 조회 전용 상태입니다.</div>}{phase==="essential"&&!owner&&<div className="empty-state">자습 운영 중 - 필수 출결 기능만 사용할 수 있습니다.</div>}{phase==="notice"&&!owner&&scheduled?.bannerEnabled&&<div className="empty-state"><strong>{scheduled.title}</strong><p>{scheduled.message}</p></div>}{phase==="notice"&&!owner&&scheduled?.popupEnabled&&!dismissed&&<section className="card"><h2>{scheduled.title}</h2><p>{scheduled.message}</p><button onClick={()=>{localStorage.setItem(`operations-notice:${noticeKey}`,"1");setDismissed(true);}}>확인</button></section>}{maintenance?<section className="empty-state"><h2>시스템 점검 중입니다.</h2><p>{scheduled?.title} {scheduled?.message}</p></section>:lockdown?<section className="empty-state"><h2>현재 시스템 이용이 제한되어 있습니다.</h2><p>{operations?.emergencyMessage}</p></section>:<Outlet/>}</>}</main></div>;
}
