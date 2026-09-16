import type { PropsWithChildren } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { isGradeAdmin, isOwner } from "../domain/access";

export function GradeAdminRoute({ children }: PropsWithChildren) {
  const { appUser } = useAuth();
  return isGradeAdmin(appUser) ? children : <Navigate to="/" replace />;
}

export function OwnerRoute({ children }: PropsWithChildren) {
  const { appUser } = useAuth();
  return isOwner(appUser) ? children : <Navigate to="/" replace />;
}
