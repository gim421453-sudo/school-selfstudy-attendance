import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { useScope } from "../scope/ScopeProvider";

export function GradeAdminRoute({ children }: PropsWithChildren) {
  const { appUser } = useAuth();
  const { scope, assignments } = useScope();
  const allowed = isSystemOwner(appUser) || Boolean(scope?.gradeId && appUser && isGradeAdminForGrade(assignments, appUser.uid, scope.academicYearId, scope.gradeId));
  return allowed ? children : <Navigate to="/" replace />;
}

export function OwnerRoute({ children }: PropsWithChildren) {
  const { appUser } = useAuth();
  return isSystemOwner(appUser) ? children : <Navigate to="/" replace />;
}
