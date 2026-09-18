import { execFileSync } from "node:child_process";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { detectSensitiveContent, isSafeLocalCaptureUrl, koreanDate, manifestEntry, parseCaptureMode, selectScreens } from "./devlog-screenshot-lib.mjs";

const root = process.cwd();
const mode = parseCaptureMode(process.argv.slice(2));
const date = koreanDate();
const outputDir = path.join(root, "개발일지", "자습 출결관리", "assets", date);
const screenshotsDir = path.join(outputDir, "screenshots");
const baseUrl = process.env.DEVLOG_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:5173";
const testMode = process.env.DEVLOG_SCREENSHOT_TEST_MODE === "1";
const testEmail = process.env.DEVLOG_SCREENSHOT_TEST_EMAIL || "devlog-admin@example.test";
const testPassword = process.env.DEVLOG_SCREENSHOT_TEST_PASSWORD;
const readiness = {
  "/": /학교 운영 대시보드|학년 운영 대시보드/,
  "/self-study-attendance": /자습 출결|관리자 출결 보정/,
  "/supervision": /감독교사 배정/,
  "/my-supervision": /감독교사 일정/,
  "/self-study-statistics": /자습 출결 통계/,
  "/admin/staff": /교직원 \/ 권한 관리/,
};
const readinessSelectors = {
  "/supervision": ".supervision-calendar, .table-wrap",
  "/my-supervision": ".page-header + .card",
  "/self-study-statistics": ".filter-grid",
};

readiness["/supervision"] = /\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815/;
readiness["/my-supervision"] = /\uAC10\uB3C5\uAD50\uC0AC \uC77C\uC815/;
readiness["/self-study-statistics"] = /\uC790\uC2B5 \uCD9C\uACB0 \uD1B5\uACC4/;

async function waitForReady(page, candidate) {
  const expectedPath = new URL(candidate.route, baseUrl).pathname;
  const actualPath = new URL(page.url()).pathname;
  if (actualPath !== expectedPath) throw new Error(`ROUTE_MISMATCH: expected ${expectedPath}, got ${actualPath}`);
  const heading = page.getByRole("heading", { name: readiness[candidate.route] ?? /.*/ }).first();
  try { await heading.waitFor({ state: "visible", timeout: 5_000 }); }
  catch {
    if (!readinessSelectors[candidate.route]) throw new Error("UI_READY_TIMEOUT: route-specific heading was not rendered");
    await page.locator(readinessSelectors[candidate.route]).first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => { throw new Error("UI_READY_TIMEOUT: route-specific content was not rendered"); });
  }
  const loadingText = /불러오는 중|로딩 중|확인하는 중|Loading/i;
  await page.waitForFunction((source) => !new RegExp(source, "i").test(document.body.innerText), loadingText.source, { timeout: 15_000 }).catch(() => { throw new Error("UI_READY_TIMEOUT: loading UI remains"); });
  await page.waitForTimeout(150);
}

function gitLines(args) {
  try { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean); }
  catch { return []; }
}

function changedFiles() {
  return [...new Set([...gitLines(["diff", "--name-only", "HEAD"]), ...gitLines(["diff", "--cached", "--name-only"]), ...gitLines(["ls-files", "--others", "--exclude-standard"])])];
}

function readme(entries, skipped) {
  const lines = [
    `# ${date} 개발일지 첨부 자료`,
    "",
    `모드: ${mode}`,
    "",
    "## 캡처된 화면",
    ...(entries.length ? entries.map((entry) => `- ${entry.file}: ${entry.title} — ${entry.reason} (본문 삽입 위치: ${entry.category}, 게시 가능: ${entry.publishCandidate ? "검토 후 가능" : "불가"})`) : ["- 없음"]),
    "",
    "## 캡처하지 않은 화면",
    ...(skipped.length ? skipped.map((entry) => `- ${entry.title ?? entry.route ?? "관련 화면"}: ${entry.status} — ${entry.notes}`) : ["- 없음"]),
    "",
    "## 게시 전 확인",
    "- 실제 학생·교직원 정보, 계정 정보, 내부 주소, 토큰 또는 키가 화면에 없는지 다시 확인합니다.",
    "- `publishCandidate: true` 항목도 사람이 최종 검토한 뒤에만 게시 후보로 사용합니다.",
  ];
  return `${lines.join("\n")}\n`;
}

async function writeArtifacts(entries, skipped) {
  const generatedAt = new Date().toISOString();
  await mkdir(screenshotsDir, { recursive: true });
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify({ generatedAt, mode, testMode, screenshots: entries, skipped }, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "README.md"), readme(entries, skipped), "utf8");
}

const requestedRoutes = process.env.DEVLOG_SCREENSHOT_ROUTES?.split(",").filter(Boolean);
const candidates = selectScreens(mode, changedFiles()).filter((candidate) => !requestedRoutes || requestedRoutes.includes(candidate.route));
const entries = [];
const skipped = [];

if (candidates.length === 0) {
  skipped.push({ status: "NO_RELATED_CHANGED_SCREENS", notes: "현재 Git 변경에서 화면 경로와 직접 연결된 파일을 찾지 못했습니다." });
  await writeArtifacts(entries, skipped);
  console.log(`No related screens for changed mode. Manifest written to ${outputDir}`);
  process.exit(0);
}

if (!testMode) {
  for (const candidate of candidates) skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "AUTH_CAPTURE_NOT_CONFIGURED", notes: "테스트 전용 인증·데이터 환경이 구성되지 않아 캡처하지 않았습니다." }));
  await writeArtifacts(entries, skipped);
  console.log(`Safe test capture is not configured. Manifest written to ${outputDir}`);
  process.exit(0);
}

if (!isSafeLocalCaptureUrl(baseUrl)) {
  for (const candidate of candidates) skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "UNSAFE_CAPTURE_URL", notes: "로컬 HTTP 주소만 캡처할 수 있습니다." }));
  await writeArtifacts(entries, skipped);
  console.log(`Unsafe capture URL blocked. Manifest written to ${outputDir}`);
  process.exit(0);
}

let browser;
try {
  browser = await chromium.launch();
  for (const candidate of candidates) {
    const [width, height] = candidate.viewport.split("x").map(Number);
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(new URL(candidate.route, baseUrl).toString(), { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      if (new URL(page.url()).pathname === "/login") {
        if (!testPassword) {
          skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "AUTH_CAPTURE_NOT_CONFIGURED", notes: "테스트 비밀번호가 제공되지 않아 로그인하지 않았습니다." }));
        } else {
          await page.getByLabel("테스트 이메일").fill(testEmail);
          await page.getByLabel("테스트 비밀번호").fill(testPassword);
          await page.getByRole("button", { name: "테스트 환경 로그인" }).click();
          await page.locator('[data-devlog-auth-state="ready"]').waitFor({ state: "attached", timeout: 15_000 });
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          if (new URL(page.url()).pathname !== new URL(candidate.route, baseUrl).pathname) {
            await page.goto(new URL(candidate.route, baseUrl).toString(), { waitUntil: "domcontentloaded" });
            await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          }
        }
      }
      if (new URL(page.url()).pathname === "/login") {
        skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "AUTH_CAPTURE_NOT_CONFIGURED", notes: "테스트 인증이 적용되지 않아 로그인 화면에 머물렀습니다." }));
      } else {
        await page.locator('[data-devlog-auth-state="ready"]').waitFor({ state: "attached", timeout: 15_000 });
        await page.waitForFunction(() => !document.body.innerText.includes("확인하는 중"), undefined, { timeout: 10_000 }).catch(() => undefined);
        if (candidate.route === "/") await page.getByText("학교 운영 대시보드").waitFor({ timeout: 10_000 }).catch(() => undefined);
        if (candidate.prepare === "open-mobile-menu") await page.getByRole("button", { name: /메뉴 열기/ }).click({ timeout: 5_000 });
        await waitForReady(page, candidate);
        const text = await page.locator("body").innerText();
        if (detectSensitiveContent(text)) {
          skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, requiresRedaction: true, status: "SENSITIVE_CONTENT_DETECTED", notes: "민감정보 가능성이 감지되어 이미지 파일을 만들지 않았습니다." }));
        } else {
          const screenshotPath = path.join(screenshotsDir, candidate.file);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          const finalText = await page.locator("body").innerText();
          if (/불러오는 중|로딩 중|확인하는 중|Loading/i.test(finalText)) {
            await unlink(screenshotPath).catch(() => undefined);
            skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, captureStatus: "UI_READY_TIMEOUT", status: "UI_READY_TIMEOUT", notes: "캡처 직후 로딩 UI가 다시 감지되었습니다." }));
          } else {
            entries.push(manifestEntry(candidate, new Date().toISOString(), { captureStatus: "READY" }));
          }
        }
      }
    } catch (error) {
      skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "CAPTURE_FAILED", notes: error instanceof Error ? error.message : "알 수 없는 캡처 오류" }));
    } finally {
      await page.close();
    }
  }
} catch (error) {
  for (const candidate of candidates) skipped.push(manifestEntry(candidate, new Date().toISOString(), { publishCandidate: false, status: "PLAYWRIGHT_BROWSER_NOT_INSTALLED", notes: error instanceof Error ? error.message : "브라우저를 시작할 수 없습니다." }));
} finally {
  await browser?.close();
}

await writeArtifacts(entries, skipped);
console.log(`Captured ${entries.length} screen(s). Manifest written to ${outputDir}`);
