import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useAuth } from "../auth/AuthProvider";
import { chooseInitialSchoolScope, filterGradesForYear, isValidSchoolScope, isSystemOwner } from "../domain/scope";
import { listAcademicYears } from "../services/academicYears";
import { listGrades } from "../services/grades";
import { listAssignmentsForUser } from "../services/staffAssignments";
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
  const { appUser } = useAuth();
  const [years, setYears] = useState<AcademicYear[]>([]); const [grades, setGrades] = useState<Grade[]>([]); const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [scope, setScopeState] = useState<SchoolScope | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!appUser) return;
    let alive = true; setLoading(true); setError(null);
    void (async () => {
      try {
        const nextYears = await listAcademicYears();
        const nextAssignments = isSystemOwner(appUser) ? [] : await Promise.all(nextYears.map((year) => listAssignmentsForUser(year.id, appUser.uid))).then((items) => items.flat());
        const allowedYears = isSystemOwner(appUser) ? nextYears : nextYears.filter((year) => nextAssignments.some((assignment) => assignment.academicYearId === year.id && assignment.active));
        const nextGrades = (await Promise.all(allowedYears.map((year) => listGrades(year.id)))).flat();
        if (!alive) return;
        const stored = readStoredScope();
        const nextScope = isValidSchoolScope(nextYears, nextGrades, nextAssignments, appUser, stored) ? stored : chooseInitialSchoolScope(nextYears, nextGrades, nextAssignments, appUser);
        setYears(nextYears); setGrades(nextGrades); setAssignments(nextAssignments); setScopeState(nextScope);
        if (nextScope) localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScope)); else localStorage.removeItem(STORAGE_KEY);
      } catch { if (alive) setError("학년도 또는 학년 권한 정보를 불러오지 못했습니다."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [appUser]);
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
