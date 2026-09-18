import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  type User,
} from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { auth } from "../lib/firebase";
import { getAppUser } from "../services/users";
import { ensurePendingUser } from "../services/pendingUsers";
import type { AppUser, PendingUser } from "../types/domain";

interface AuthContextValue {
  firebaseUser: User | null;
  appUser: AppUser | null;
  pendingUser: PendingUser | null;
  loading: boolean;
  loginWithGoogle(): Promise<void>;
  logout(): Promise<void>;
  loginWithDevlogTest(email: string, password: string): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export function AuthProvider({ children }: PropsWithChildren) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);
      setAppUser(null);
      setPendingUser(null);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const account = await getAppUser(user.uid);
        setAppUser(account);
        if (!account) setPendingUser(await ensurePendingUser(user));
      } catch {
        setAppUser(null);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      appUser,
      pendingUser,
      loading,
      async loginWithGoogle() {
        await signInWithPopup(auth, googleProvider);
      },
      async logout() {
        await signOut(auth);
      },
      async loginWithDevlogTest(email, password) {
        if (import.meta.env.VITE_DEVLOG_SCREENSHOT_TEST_MODE !== "1") throw new Error("Test login is disabled.");
        await signInWithEmailAndPassword(auth, email, password);
      },
    }),
    [firebaseUser, appUser, pendingUser, loading],
  );

  const devlogAuthState = import.meta.env.VITE_DEVLOG_SCREENSHOT_TEST_MODE === "1"
    ? (loading ? "loading" : firebaseUser && appUser ? "ready" : firebaseUser ? "profile-not-ready" : "signed-out")
    : undefined;
  return <AuthContext.Provider value={value}>
    {devlogAuthState && <span data-devlog-auth-state={devlogAuthState} hidden />}
    {children}
  </AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
