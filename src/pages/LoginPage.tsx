import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { canEnterApplication, googleSignInErrorMessage } from "../auth/authorization";

const copy = {
  title: "\uD559\uAD50 \uC790\uC728\uD559\uC2B5 \uCD9C\uACB0\uAD00\uB9AC",
  checking: "\uB85C\uADF8\uC778 \uC815\uBCF4\uB97C \uD655\uC778\uD558\uB294 \uC911...",
  approvalNeeded: "\uC811\uADFC \uC2B9\uC778 \uD544\uC694",
  pending: "\uAD50\uC9C1\uC6D0 \uACC4\uC815 \uC2B9\uC778 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4.",
  unapproved: "\uB4F1\uB85D\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC2B9\uC778\uB418\uC9C0 \uC54A\uC740 \uAD50\uC9C1\uC6D0 \uACC4\uC815\uC785\uB2C8\uB2E4.",
  logout: "\uB85C\uADF8\uC544\uC6C3",
  signIn: "G  Google \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778",
  signingIn: "Google \uB85C\uADF8\uC778 \uC911...",
  staffOnly: "\uB4F1\uB85D\uB41C \uAD50\uC9C1\uC6D0 Google \uACC4\uC815\uB9CC \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
};

export function LoginPage() {
  const { firebaseUser, appUser, pendingUser, loading, loginWithGoogle, logout } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (canEnterApplication(firebaseUser, appUser)) return <Navigate to="/" replace />;

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await loginWithGoogle();
    } catch (loginError) {
      setError(googleSignInErrorMessage(loginError));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="center-page">{copy.checking}</div>;

  if (firebaseUser) {
    return (
      <div className="login-page">
        <div className="login-panel">
          <div className="eyebrow">{copy.title}</div>
          <h1>{pendingUser ? copy.pending : copy.approvalNeeded}</h1>
          <p>{pendingUser ? pendingUser.displayName : copy.unapproved}</p>
          <p className="muted">{pendingUser?.email ?? firebaseUser.email ?? "Google account"}</p>
          <button className="primary" onClick={() => void logout()}>{copy.logout}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="eyebrow">{copy.title}</div>
        <h1>{copy.title}</h1>
        <button className="primary google-login-button" onClick={() => void signIn()} disabled={busy}>
          {busy ? copy.signingIn : copy.signIn}
        </button>
        <p className="muted">{copy.staffOnly}</p>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
