import { useEffect, useMemo, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { useAuth } from "../auth/AuthProvider";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { listClasses } from "../services/classes";
import { listSelfStudyAttendanceHistory, summarizeSelfStudyAttendance, summarizeSelfStudyAttendanceBy } from "../services/selfStudyReporting";
import { useScope } from "../scope/ScopeProvider";

export function SelfStudyStatisticsPage() {
  const { appUser } = useAuth(); const { scope, assignments } = useScope(); const [start,setStart]=useState(format(startOfMonth(new Date()),"yyyy-MM-dd")); const [end,setEnd]=useState(format(new Date(),"yyyy-MM-dd")); const [records,setRecords]=useState<any[]>([]); const [classes,setClasses]=useState<any[]>([]);
  const current=scope?.gradeId?{academicYearId:scope.academicYearId,gradeId:scope.gradeId}:null; const owner=isSystemOwner(appUser); const admin=Boolean(appUser&&current&&isGradeAdminForGrade(assignments,appUser.uid,current.academicYearId,current.gradeId));
  useEffect(()=>{if(!current)return;void listClasses(current.academicYearId,current.gradeId).then(setClasses);},[current?.academicYearId,current?.gradeId]);
  const ownClass=classes.find(c=>c.active&&c.homeroomTeacherUid===appUser?.uid)?.id;
  useEffect(()=>{if(!current||(!owner&&!admin&&!ownClass))return;void listSelfStudyAttendanceHistory({...current,startDate:start,endDate:end,...(!owner&&!admin?{classId:ownClass}:{})}).then(setRecords);},[current?.academicYearId,current?.gradeId,start,end,owner,admin,ownClass]);
  const counts=summarizeSelfStudyAttendance(records); const byStudent=useMemo(()=>summarizeSelfStudyAttendanceBy(records,r=>r.studentId),[records]);
  if(!current)return <section className="empty-state"><h2>학년을 선택하세요.</h2></section>; if(!owner&&!admin&&!ownClass)return <section className="empty-state"><h2>담임 반 통계만 조회할 수 있습니다.</h2></section>;
  return <><header className="page-header"><div><div className="eyebrow">자습 출결 통계</div><h2>자습 출결 통계</h2></div></header><section className="card filter-grid"><label>시작<input type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>종료<input type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label></section><section className="card"><div className="self-study-counts"><strong>전체 {counts.total}</strong><span>출석 {counts.present}</span><span>인정 결석 {counts.excused}</span><span>무단 결석 {counts.unexcused}</span></div><p className="muted">미입력은 결석으로 계산하지 않으며, 통계 분모는 기록된 자습 출결입니다.</p></section><section className="card table-wrap"><h3>학생별 통계</h3><table><thead><tr><th>학생</th><th>출석</th><th>인정 결석</th><th>무단 결석</th></tr></thead><tbody>{[...byStudent].map(([id,c])=><tr key={id}><td>{id}</td><td>{c.present}</td><td>{c.excused}</td><td>{c.unexcused}</td></tr>)}</tbody></table></section></>;
}
