import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const devlogTestMode = import.meta.env.VITE_DEVLOG_SCREENSHOT_TEST_MODE === "1";
const localHostPattern = /^(127\.0\.0\.1|localhost|\[?::1\]?)(:\d+)?$/;
const authEmulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreEmulatorHost = import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

if (devlogTestMode && (!localHostPattern.test(authEmulatorHost) || !localHostPattern.test(firestoreEmulatorHost))) {
  throw new Error("DEVLOG_SCREENSHOT_TEST_MODE requires local Firebase Emulator hosts.");
}

const firebaseConfig = {
  apiKey: devlogTestMode ? "devlog-emulator-key" : import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: devlogTestMode ? "localhost" : import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: devlogTestMode ? "school-selfstudy-attendance-devlog" : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: devlogTestMode ? "devlog-local" : import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: devlogTestMode ? "devlog" : import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: devlogTestMode ? "devlog-emulator" : import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missing.length) {
  console.warn(`Firebase 환경변수 누락: ${missing.join(", ")}`);
}

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

if (devlogTestMode) {
  const [authHost, authPort = "9099"] = authEmulatorHost.split(":");
  const [firestoreHost, firestorePort = "8080"] = firestoreEmulatorHost.split(":");
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, Number(firestorePort));
}
