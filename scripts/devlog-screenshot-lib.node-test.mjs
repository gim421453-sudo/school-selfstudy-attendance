import assert from "node:assert/strict";
import test from "node:test";
import { detectSensitiveContent, isSafeLocalCaptureUrl, koreanDate, parseCaptureMode, selectScreens } from "./devlog-screenshot-lib.mjs";

test("changed mode keeps only screens related to changed source files", () => {
  const selected = selectScreens("changed", ["src/pages/SupervisionPage.tsx", "src/domain/supervisionCalendar.ts"]);
  assert.deepEqual(selected.map((item) => item.file), ["03-supervisor-calendar.png"]);
});

test("full mode includes every registered screen", () => {
  assert.ok(selectScreens("full", []).length >= 7);
  assert.equal(parseCaptureMode([]), "changed");
  assert.equal(parseCaptureMode(["--mode", "full"]), "full");
  assert.throws(() => parseCaptureMode(["--mode", "unknown"]));
});

test("only local HTTP URLs are eligible for automated capture", () => {
  assert.equal(isSafeLocalCaptureUrl("http://127.0.0.1:5173"), true);
  assert.equal(isSafeLocalCaptureUrl("http://localhost:4173"), true);
  assert.equal(isSafeLocalCaptureUrl("https://example.com"), false);
  assert.equal(isSafeLocalCaptureUrl("http://192.168.0.10:5173"), false);
});

test("sensitive-content detector blocks common disclosure patterns", () => {
  assert.equal(detectSensitiveContent("교사 계정: user@example.com"), true);
  assert.equal(detectSensitiveContent("access_token=secret"), true);
  assert.equal(detectSensitiveContent("테스트 학생 A, 2학년 1반"), false);
  assert.match(koreanDate(new Date("2026-09-18T00:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});
