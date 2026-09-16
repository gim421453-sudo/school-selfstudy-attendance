import { spawnSync } from "node:child_process";

const result = spawnSync("java", ["-version"], { stdio: "ignore" });
if (result.error || result.status !== 0) {
  console.error("ERROR: Java runtime is required for Firestore Emulator.");
  process.exit(1);
}

const firebase = process.platform === "win32"
  ? spawnSync("powershell.exe", ["-NoProfile", "-Command", "firebase --version"], { stdio: "ignore" })
  : spawnSync("firebase", ["--version"], { stdio: "ignore" });
if (firebase.error || firebase.status !== 0) {
  console.error("ERROR: Firebase CLI is required for Firestore Emulator.");
  process.exit(1);
}
