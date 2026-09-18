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
  const { firebaseUser, appUser, pendingUser, loading, loginWithGoogle, loginWithDevlogTest, logout } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testEmail, setTestEmail] = useState("devlog-admin@example.test");
  const [testPassword, setTestPassword] = useState("");
  const testMode = import.meta.env.VITE_DEVLOG_SCREENSHOT_TEST_MODE === "1";

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

  async function signInTest() {
    setBusy(true); setError("");
    try { await loginWithDevlogTest(testEmail, testPassword); }
    catch (loginError) { setError(loginError instanceof Error ? loginError.message : String(loginError)); }
    finally { setBusy(false); }
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
        {testMode && <form className="devlog-test-login" onSubmit={(event) => { event.preventDefault(); void signInTest(); }}>
          <div className="eyebrow">개발일지 캡처용 로컬 테스트</div>
          <label>테스트 이메일<input aria-label="테스트 이메일" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} /></label>
          <label>테스트 비밀번호<input aria-label="테스트 비밀번호" type="password" value={testPassword} onChange={(event) => setTestPassword(event.target.value)} /></label>
          <button type="submit" className="secondary" disabled={busy}>테스트 환경 로그인</button>
        </form>}
        <p className="muted">{copy.staffOnly}</p><p className="muted">Google 인증만으로 사용 권한이 생기지 않으며, 승인 후 학년도·학년 배정이 있어야 업무 화면에 들어갈 수 있습니다.</p>
        {error && <div className="error-box">{error}</div>}
      </div>
    </div>
  );
}
