import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuth } from "../auth/AuthProvider";
import { currentAcademicYearInitializationError, filterGradesForYear, isSystemOwner, isValidSchoolScope, resolveSchoolScope } from "../domain/scope";
import { makeStaffAssignmentId } from "../domain/ids";
import { listAcademicYears, listActiveAcademicYears } from "../services/academicYears";
import { getGrade, listGrades } from "../services/grades";
import { listAssignmentsForAuthenticatedUser } from "../services/staffAssignments";
import type { AcademicYear, Grade, SchoolScope, StaffAssignment } from "../types/domain";

const STORAGE_KEY = "school-selfstudy-attendance.scope";
type ScopeContextValue = { scope: SchoolScope | null; years: AcademicYear[]; grades: Grade[]; assignments: StaffAssignment[]; loading: boolean; error: string | null; setScope: (scope: SchoolScope) => void; selectableYears: AcademicYear[]; selectableGrades: Grade[] };
const ScopeContext = createContext<ScopeContextValue | null>(null);

function readStoredScope(): SchoolScope | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return typeof value?.academicYearId === "string" && (typeof value.gradeId === "string" || value.gradeId === null) ? value : null;
  } catch { return null; }
}

export function ScopeProvider({ children }: PropsWithChildren) {
  const { appUser, firebaseUser } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]); const [grades, setGrades] = useState<Grade[]>([]); const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [scope, setScopeState] = useState<SchoolScope | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!appUser || !firebaseUser) return;
    let alive = true; setLoading(true); setError(null);
    void (async () => {
      let stage = "A:academicYears";
      try {
        const owner = isSystemOwner(appUser);
        console.debug("[scopeBootstrap]", stage, { owner });
        const nextYears = owner ? await listAcademicYears() : await listActiveAcademicYears();
        console.debug("[scopeBootstrap] A:academicYears:result", { activeYearCount: nextYears.length, currentYearIds: nextYears.filter((year) => year.isCurrent).map((year) => year.id) });
        const currentYearError = currentAcademicYearInitializationError(nextYears);
        if (currentYearError) throw new Error(currentYearError);
        stage = "B:staffAssignments";
        console.debug("[scopeBootstrap]", stage, { academicYearIds: nextYears.map((year) => year.id), authUserMatchesProfile: firebaseUser.uid === appUser.uid });
        const assignmentQuery = owner ? { assignments: [], rawSnapshotCount: 0, rejectedDocumentCount: 0, rejectedReasonCodes: [] } : await listAssignmentsForAuthenticatedUser(firebaseUser.uid);
        const nextAssignments = assignmentQuery.assignments;
        console.debug("[scopeBootstrap] B:staffAssignments:raw", { rawSnapshotCount: assignmentQuery.rawSnapshotCount, parsedAssignmentCount: nextAssignments.length, rejectedDocumentCount: assignmentQuery.rejectedDocumentCount, rejectedReasonCodes: assignmentQuery.rejectedReasonCodes });
        console.debug("[scopeBootstrap] B:staffAssignments:result", { assignmentResultCount: nextAssignments.length, activeAssignmentCount: nextAssignments.filter((assignment) => assignment.active).length, currentYearAssignmentCount: nextAssignments.filter((assignment) => nextYears.some((year) => year.id === assignment.academicYearId)).length, nonCanonicalDocumentIdCount: nextAssignments.filter((assignment) => assignment.id !== makeStaffAssignmentId(assignment.academicYearId, assignment.gradeId, assignment.uid)).length });
        const rejectedAssignmentReasons: string[] = [];
        const canonicalAssignments = owner ? [] : nextAssignments.filter((assignment) => {
          if (assignment.uid !== firebaseUser.uid) { rejectedAssignmentReasons.push("uid_mismatch"); return false; }
          if (!assignment.active) { rejectedAssignmentReasons.push("inactive"); return false; }
          if (typeof assignment.academicYearId !== "string" || !assignment.academicYearId || typeof assignment.gradeId !== "string" || !assignment.gradeId) { rejectedAssignmentReasons.push("invalid_scope"); return false; }
          if (assignment.role !== "teacher" && assignment.role !== "grade_admin") { rejectedAssignmentReasons.push("invalid_role"); return false; }
          return true;
        });
        const allowedYears = owner ? nextYears : nextYears.filter((year) => canonicalAssignments.some((assignment) => assignment.academicYearId === year.id));
        stage = "C:grades";
        console.debug("[scopeBootstrap]", stage, { gradeIds: owner ? [] : nextAssignments.filter((assignment) => assignment.active).map((assignment) => assignment.gradeId) });
        const nextGrades = owner
          ? (await Promise.all(allowedYears.map((year) => listGrades(year.id)))).flat()
          : (await Promise.all(canonicalAssignments.map((assignment) => getGrade(assignment.gradeId))))
            .filter((grade): grade is Grade => Boolean(grade?.active && grade.academicYearId && allowedYears.some((year) => year.id === grade.academicYearId)));
        const gradeById = new Map(nextGrades.map((grade) => [grade.id, grade]));
        const usableAssignments = owner ? [] : canonicalAssignments.filter((assignment) => {
          const grade = gradeById.get(assignment.gradeId);
          if (!grade) { rejectedAssignmentReasons.push("grade_unavailable"); return false; }
          if (grade.academicYearId !== assignment.academicYearId) { rejectedAssignmentReasons.push("grade_year_mismatch"); return false; }
          return true;
        });
        if (!alive) return;
        stage = "D:resolve";
        console.debug("[scopeBootstrap]", stage, { assignmentResultCount: nextAssignments.length, canonicalAssignmentCount: canonicalAssignments.length, usableAssignmentCount: usableAssignments.length, gradeCount: nextGrades.length, rejectedReasons: [...new Set(rejectedAssignmentReasons)] });
        const stored = readStoredScope();
        const nextScope = resolveSchoolScope(nextYears, nextGrades, usableAssignments, appUser, stored);
        console.debug("[scopeBootstrap] resolved", { state: nextScope ? "READY" : "MISSING", academicYearId: nextScope?.academicYearId ?? null, gradeId: nextScope?.gradeId ?? null });
        setYears(nextYears); setGrades(nextGrades); setAssignments(usableAssignments); setScopeState(nextScope);
        if (nextScope) localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScope)); else localStorage.removeItem(STORAGE_KEY);
      } catch (caught) { console.error("[scopeBootstrap] failed", { stage, code: typeof caught === "object" && caught !== null && "code" in caught ? caught.code : undefined }, caught); if (alive) setError("학년도와 학년 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [appUser, firebaseUser]);
  const setScope = (next: SchoolScope) => {
    if (!isValidSchoolScope(years, grades, assignments, appUser, next)) return;
    setScopeState(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };
  const selectableYears = isSystemOwner(appUser) ? years.filter((year) => year.active) : years.filter((year) => assignments.some((assignment) => assignment.academicYearId === year.id && assignment.active));
  const selectableGrades = scope ? filterGradesForYear(grades, scope.academicYearId).filter((grade) => isSystemOwner(appUser) || assignments.some((assignment) => assignment.academicYearId === scope.academicYearId && assignment.gradeId === grade.id && assignment.active)) : [];
  const value = useMemo(() => ({ scope, years, grades, assignments, loading, error, setScope, selectableYears, selectableGrades }), [scope, years, grades, assignments, loading, error, selectableYears, selectableGrades]);
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}
export function useScope() { const value = useContext(ScopeContext); if (!value) throw new Error("useScope must be used inside ScopeProvider"); return value; }
