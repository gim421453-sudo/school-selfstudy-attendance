import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { buildGradeDashboardDiagnostics, type GradeDashboardDiagnostics } from "../domain/dashboardDiagnostics";
import { getOperationsPhase, type OperationsPhase } from "../domain/operationsState";
import { isSelfStudyDay } from "../domain/schedule";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { summarizeStaffAssignmentsByGrade, type GradeStaffAssignmentSummary } from "../domain/staffAssignmentSummary";
import { listAuditLogs } from "../services/audit";
import { listClasses } from "../services/classes";
import { getOperationsSettings } from "../services/operations";
import { listPendingUsers } from "../services/pendingUsers";
import { listScopedStudents } from "../services/scopedStudents";
import { getApplicableSelfStudyExceptions } from "../services/selfStudyExceptions";
import { listSelfStudyAttendanceHistory } from "../services/selfStudyReporting";
import { listSelfStudyGroupPeriods, listSelfStudyGroups, listSelfStudyMemberships, listSupervisionAssignments } from "../services/selfStudyOperations";
import { listAssignmentsForGrade, listAssignmentsForYear } from "../services/staffAssignments";
import { listUsers } from "../services/users";
import { useScope } from "../scope/ScopeProvider";
import type { OperationsSettings } from "../types/domain";

type Summary = GradeDashboardDiagnostics & { gradeId: string };
const zero: GradeDashboardDiagnostics = { studentCount: 0, classCount: 0, groupCount: 0, unassignedStudentCount: 0, missingGradeAdmin: false, missingHomeroomCount: 0, missingSupervisionCount: 0, presentCount: 0, excusedCount: 0, unexcusedCount: 0, missingAttendanceCount: 0 };
const phaseLabels: Record<OperationsPhase, string> = { normal: "정상 운영", read_only: "읽기 전용", essential: "필수 업무만", notice: "점검 사전공지", maintenance: "점검 중", lockdown: "운영 제한" };

function timestampDate(value: unknown) { return value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : null; }

async function loadGradeSummary(academicYearId: string, gradeId: string, date: string): Promise<Summary> {
  const scope = { academicYearId, gradeId };
  const [students, classes, groups, memberships, edges, assignments, supervision, exceptions, attendance] = await Promise.all([
    listScopedStudents(scope), listClasses(academicYearId, gradeId), listSelfStudyGroups(scope), listSelfStudyMemberships(scope), listSelfStudyGroupPeriods(scope), listAssignmentsForGrade(academicYearId, gradeId), listSupervisionAssignments(scope, { date }), getApplicableSelfStudyExceptions(scope, date), listSelfStudyAttendanceHistory({ ...scope, startDate: date, endDate: date }),
  ]);
  const wholeDayException = exceptions.some((exception) => !exception.periodIds);
  return { gradeId, ...buildGradeDashboardDiagnostics({ date, operationalDay: isSelfStudyDay(date) && !wholeDayException, students, classes, groups, memberships, edges, assignments, supervision, exceptions, attendance }) };
}

export function DashboardPage() {
  const { appUser } = useAuth(); const { scope, grades, assignments, years } = useScope();
  const today = format(new Date(), "yyyy-MM-dd"); const owner = isSystemOwner(appUser);
  const ownGradeAdmin = Boolean(scope?.gradeId && appUser && isGradeAdminForGrade(assignments, appUser.uid, scope.academicYearId, scope.gradeId));
  const [summaries, setSummaries] = useState<Summary[]>([]); const [pendingCount, setPendingCount] = useState(0); const [unassignedStaffCount, setUnassignedStaffCount] = useState(0); const [recentAudit, setRecentAudit] = useState<string[]>([]); const [staffByGrade, setStaffByGrade] = useState<GradeStaffAssignmentSummary[]>([]); const [operations, setOperations] = useState<OperationsSettings | null>(null); const [error, setError] = useState<string | null>(null);
  const scopes = useMemo(() => !scope ? [] : scope.gradeId ? [{ academicYearId: scope.academicYearId, gradeId: scope.gradeId }] : grades.filter((grade) => grade.academicYearId === scope.academicYearId && grade.active).map((grade) => ({ academicYearId: scope.academicYearId, gradeId: grade.id })), [scope, grades]);
  useEffect(() => {
    if (!scope || (!owner && !ownGradeAdmin)) { setSummaries([]); return; }
    let alive = true; setError(null);
    void Promise.all(scopes.map((item) => loadGradeSummary(item.academicYearId, item.gradeId, today))).then((next) => { if (alive) setSummaries(next); }).catch(() => { if (alive) setError("대시보드 진단 정보를 불러오지 못했습니다."); });
    if (owner) {
      void listPendingUsers().then((users) => { if (alive) setPendingCount(users.length); }).catch(() => { if (alive) setPendingCount(0); });
      void Promise.all([listUsers(), listAssignmentsForYear(scope.academicYearId)]).then(([users, yearAssignments]) => {
        if (!alive) return;
        setUnassignedStaffCount(users.filter((user) => user.active && !isSystemOwner(user) && !yearAssignments.some((assignment) => assignment.uid === user.uid && assignment.active)).length);
        setStaffByGrade(summarizeStaffAssignmentsByGrade(grades, yearAssignments, scope.academicYearId));
      });
      void listAuditLogs(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), new Date()).then((logs) => { if (alive) setRecentAudit(logs.slice(0, 5).map((log) => `${log.action} · ${log.actorName}`)); }).catch(() => { if (alive) setRecentAudit([]); });
      void getOperationsSettings().then((value) => { if (alive) setOperations(value); }).catch(() => { if (alive) setOperations(null); });
    }
    return () => { alive = false; };
  }, [scope, scopes, today, owner, ownGradeAdmin, grades]);
  const total = summaries.reduce((value, item) => ({ ...value, studentCount: value.studentCount + item.studentCount, classCount: value.classCount + item.classCount, groupCount: value.groupCount + item.groupCount, unassignedStudentCount: value.unassignedStudentCount + item.unassignedStudentCount, missingHomeroomCount: value.missingHomeroomCount + item.missingHomeroomCount, missingSupervisionCount: value.missingSupervisionCount + item.missingSupervisionCount, presentCount: value.presentCount + item.presentCount, excusedCount: value.excusedCount + item.excusedCount, unexcusedCount: value.unexcusedCount + item.unexcusedCount, missingAttendanceCount: value.missingAttendanceCount + item.missingAttendanceCount }), zero);
  const currentYear = years.find((year) => year.id === scope?.academicYearId); const phase = getOperationsPhase(operations); const maintenance = operations?.maintenance; const start = timestampDate(maintenance?.startsAt); const end = timestampDate(maintenance?.endsAt);
  const cards: Array<[string, number]> = owner ? [["승인 대기 사용자", pendingCount], ["학년도 미배정 사용자", unassignedStaffCount], ["자습반 미배정 학생", total.unassignedStudentCount], ["학년부 미지정", summaries.filter((item) => item.missingGradeAdmin).length], ["담임 미지정", total.missingHomeroomCount], ["감독 미배정", total.missingSupervisionCount], ["출결 미입력", total.missingAttendanceCount]] : [["학생", total.studentCount], ["반", total.classCount], ["자습 그룹", total.groupCount], ["자습반 미배정 학생", total.unassignedStudentCount], ["오늘 감독 미배정", total.missingSupervisionCount], ["출결 미입력", total.missingAttendanceCount], ["인정결석", total.excusedCount], ["무단결석", total.unexcusedCount]];
  return <><header className="page-header"><div><div className="eyebrow">{format(new Date(), "yyyy년 M월 d일 EEEE", { locale: ko })}</div><h2>{owner ? "학교 운영 대시보드" : "학년 운영 대시보드"}</h2><p className="muted">{currentYear?.displayName ?? "학년도 미선택"} · {scope?.gradeId === null ? "전체 학년" : "선택 학년"}</p></div></header>{error && <div className="empty-state text-danger">{error}</div>}{(owner || ownGradeAdmin) ? <><section className="card"><div className="dashboard-grid">{cards.map(([label, value]) => <div key={label}><span className="muted">{label}</span><strong className="big-number">{value}</strong></div>)}</div>{owner && <div><strong>최근 감사 기록</strong>{recentAudit.length ? <ul>{recentAudit.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="muted">최근 감사 기록이 없습니다.</p>}</div>}<p className="muted">미입력은 출결 기록이 없는 예상 자습 슬롯이며 무단결석으로 자동 처리하지 않습니다.</p></section>{owner && <><section className="card"><h3>시스템 운영 상태</h3><p><strong>현재 상태: {phaseLabels[phase]}</strong></p><p className="muted">명시적 운영 모드: {operations?.emergencyMode ?? "NORMAL"}</p>{maintenance?.enabled && <p className="muted">{phase === "notice" ? "점검 사전공지 중" : phase === "maintenance" ? "점검 중" : "예약 점검"}{start && <> · 시작: {format(start, "yyyy-MM-dd HH:mm")}</>}{end && <> · 종료: {format(end, "yyyy-MM-dd HH:mm")}</>}</p>}</section><section className="card"><h3>학년별 교직원 배정 현황</h3><div className="table-wrap"><table><thead><tr><th>학년</th><th>배정 교직원</th><th>학년부</th><th>일반 교사</th></tr></thead><tbody>{staffByGrade.map((item) => <tr key={item.gradeId}><td>{item.gradeName}</td><td>{item.assignedCount}명</td><td>{item.gradeAdminCount ? `${item.gradeAdminCount}명` : "미지정"}</td><td>{item.teacherCount}명</td></tr>)}</tbody></table></div></section></>}</> : <section className="empty-state"><h2>오늘 담당 업무를 확인하세요.</h2><p>담임은 자기 반의 자습 허락과 이력·통계를, 감독교사는 배정된 자습 출결을 이용할 수 있습니다.</p></section>}</>;
}
