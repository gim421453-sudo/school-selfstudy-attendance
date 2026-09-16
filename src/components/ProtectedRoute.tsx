import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { canEnterApplication } from "../auth/authorization";
import type { PropsWithChildren } from "react";

const checkingMessage = "\uB85C\uADF8\uC778 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uB294 \uC911...";

export function ProtectedRoute({ children }: PropsWithChildren) {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return <div className="center-page">{checkingMessage}</div>;
  }

  if (!firebaseUser || !canEnterApplication(firebaseUser, appUser)) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
