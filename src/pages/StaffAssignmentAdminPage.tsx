import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { formatGlobalRoles, safeLoadError } from "../domain/presentation";
import { listAcademicYears } from "../services/academicYears";
import { listGrades } from "../services/grades";
import { assignTeacherToGrade, deactivateStaffAssignment, listAssignmentsForYear, setGradeAdmin, summarizeStaffAssignmentConsistency } from "../services/staffAssignments";
import { listUsers } from "../services/users";
import type { AcademicYear, AppUser, Grade, StaffAssignment } from "../types/domain";

type AssignmentRole = "" | "teacher" | "grade_admin";

export function StaffAssignmentAdminPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [yearId, setYearId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;

  async function refresh(nextYearId = yearId) {
    const [nextUsers, nextYears] = await Promise.all([listUsers(), listAcademicYears()]);
    const selectedYear = nextYearId || nextYears.find((year) => year.active && year.isCurrent)?.id || nextYears.find((year) => year.active)?.id || "";
    const [nextGrades, nextAssignments] = selectedYear ? await Promise.all([listGrades(selectedYear), listAssignmentsForYear(selectedYear)]) : [[], []];
    console.debug("[staffAssignmentAdmin] consistency", summarizeStaffAssignmentConsistency(nextUsers, nextAssignments));
    setUsers(nextUsers); setYears(nextYears); setYearId(selectedYear); setGrades(nextGrades); setAssignments(nextAssignments);
  }

  useEffect(() => { void refresh().catch((caught) => setError(safeLoadError("staffAssignmentAdmin", caught))); }, []);

  async function selectYear(nextYearId: string) {
    setYearId(nextYearId); setError("");
    try { const [nextGrades, nextAssignments] = await Promise.all([listGrades(nextYearId), listAssignmentsForYear(nextYearId)]); console.debug("[staffAssignmentAdmin] consistency", summarizeStaffAssignmentConsistency(users, nextAssignments)); setGrades(nextGrades); setAssignments(nextAssignments); }
    catch (caught) { setError(safeLoadError("staffAssignmentAdmin.year", caught)); }
  }

  async function changeAssignment(user: AppUser, grade: Grade, role: AssignmentRole) {
    if (!actor || !yearId || !user.active) return;
    const input = { academicYearId: yearId, gradeId: grade.id, uid: user.uid, displayName: user.displayName };
    const existing = assignments.find((assignment) => assignment.uid === user.uid && assignment.gradeId === grade.id);
    setBusy(true); setError("");
    try {
      if (!role) { if (existing?.active) await deactivateStaffAssignment(input, actor); }
      else if (role === "teacher") await assignTeacherToGrade(input, actor);
      else await setGradeAdmin(input, actor);
      await refresh(yearId);
    } catch (caught) { setError(safeLoadError("staffAssignmentAdmin.save", caught, "\uAD50\uC9C1\uC6D0 \uD559\uB144 \uBC30\uC815\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.")); }
    finally { setBusy(false); }
  }

  const activeGrades = useMemo(() => grades.filter((grade) => grade.active), [grades]);
  function assignmentLabel(user: AppUser) {
    const own = assignments.filter((assignment) => assignment.uid === user.uid && assignment.active);
    if (!own.length) return "\uD559\uB144\uB3C4 \uBBF8\uBC30\uC815";
    return own.map((assignment) => `${activeGrades.find((grade) => grade.id === assignment.gradeId)?.displayName ?? "\uD559\uB144"} ${assignment.role === "grade_admin" ? "\uD559\uB144 \uAD00\uB9AC\uC790" : "\uC77C\uBC18 \uAD50\uC0AC"}`).join(", ");
  }

  return <>
    <header className="page-header"><div><div className="eyebrow">{"\uC2DC\uC2A4\uD15C \uAD00\uB9AC\uC790"}</div><h2>{"\uAD50\uC9C1\uC6D0 / \uAD8C\uD55C \uAD00\uB9AC"}</h2><p className="muted">{"\uC2B9\uC778\uB41C \uAD50\uC9C1\uC6D0\uC5D0\uAC8C \uD559\uB144\uB3C4\uC640 \uD559\uB144\uC758 \uAD50\uC9C1\uC6D0 \uBC30\uC815\uC744 \uCD94\uAC00\uD569\uB2C8\uB2E4."}</p></div><label>{"\uD559\uB144\uB3C4"}<select value={yearId} onChange={(event) => void selectYear(event.target.value)}>{years.filter((year) => year.active).map((year) => <option key={year.id} value={year.id}>{year.displayName}</option>)}</select></label></header><p className="muted">일반교사와 학년관리자는 선택한 학년도·학년에만 적용됩니다. 담임은 학급 / 담임 관리에서, 감독교사는 감독교사 배정에서 별도로 지정합니다.</p>
    {error && <p className="text-danger">{error}</p>}
    <section className="card"><h3>{"\uBC30\uC815 \uAE30\uC900"}</h3><p className="muted">{"\uB2F4\uC784\uAD50\uC0AC\uB294 \uD559\uAE09 / \uB2F4\uC784 \uAD00\uB9AC\uC5D0\uC11C \uC9C0\uC815\uD569\uB2C8\uB2E4. \uAC10\uB3C5\uAD50\uC0AC\uB294 \uBC30\uC815\uB41C \uC77C\uBC18 \uAD50\uC0AC\uB97C \uB0A0\uC9DC\u00B7\uAD50\uC2DC\u00B7\uC790\uC2B5\uADF8\uB8F9\uBCC4\uB85C \uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815\uC5D0\uC11C \uC9C0\uC815\uD569\uB2C8\uB2E4."}</p></section>
    <section className="card table-wrap"><h3>{"\uD559\uB144\uBCC4 \uAD50\uC9C1\uC6D0 \uBC30\uC815"}</h3>{!yearId || activeGrades.length === 0 ? <p className="muted">{"\uD65C\uC131 \uD559\uB144\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</p> : <table><thead><tr><th>{"\uC774\uB984 / \uC774\uBA54\uC77C"}</th><th>{"\uACC4\uC815 \uC0C1\uD0DC"}</th><th>{"\uACC4\uC815 \uC5ED\uD560"}</th><th>{"\uD604\uC7AC \uBC30\uC815"}</th>{activeGrades.map((grade) => <th key={grade.id}>{grade.displayName}</th>)}</tr></thead><tbody>{users.map((user) => <tr key={user.uid}><td><strong>{user.displayName}</strong><br /><span className="muted">{user.email}</span></td><td>{user.active ? "\uD65C\uC131" : "\uBE44\uD65C\uC131"}</td><td>{formatGlobalRoles(user)}</td><td>{user.active ? assignmentLabel(user) : assignments.some((assignment) => assignment.uid === user.uid) ? "\uACC4\uC815 \uBE44\uD65C\uC131 / \uAE30\uC874 \uBC30\uC815 \uC874\uC7AC" : "\uACC4\uC815 \uBE44\uD65C\uC131"}</td>{activeGrades.map((grade) => { const assignment = assignments.find((item) => item.uid === user.uid && item.gradeId === grade.id); const value = assignment?.active ? assignment.role : ""; return <td key={grade.id}><select aria-label={`${user.displayName} ${grade.displayName} \uBC30\uC815`} disabled={busy || !user.active} value={value} onChange={(event) => void changeAssignment(user, grade, event.target.value as AssignmentRole)}><option value="">{"\uBBF8\uBC30\uC815"}</option><option value="teacher">{"\uC77C\uBC18 \uAD50\uC0AC"}</option><option value="grade_admin">{"\uD559\uB144 \uAD00\uB9AC\uC790"}</option></select>{assignment && !assignment.active && <span className="muted">{"\uAE30\uC874 \uBE44\uD65C\uC131 \uBC30\uC815"}</span>}</td>; })}</tr>)}</tbody></table>}</section>
  </>;
}
