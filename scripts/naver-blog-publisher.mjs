import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { findInstalledBrowser, loadPacket, profilePath } from "./naver-blog-publisher-lib.mjs";

const root = process.cwd();
const packetPath = path.join(root, "개발일지", "자습 출결관리", "publish", "2026-09-18", "naver-post.json");
const stateDir = path.dirname(packetPath);
const statePath = path.join(stateDir, "_publish_state.json");
const command = process.argv[2] ?? "check";
const cdpUrl = process.env.NAVER_CDP_URL || "http://127.0.0.1:9222";

async function writeState(status) { await mkdir(stateDir, { recursive: true }); await writeFile(statePath, `${JSON.stringify({ status, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8"); }
async function check() {
  const packet = await loadPacket(packetPath);
  console.log(`PUBLISH_PACKET_VALID images=${packet.blocks.filter((block) => block.type === "image").length}`);
  await writeState("PREPARED");
}
async function launchBrowser() {
  const browser = await findInstalledBrowser();
  const child = spawn(browser.executable, [`--remote-debugging-port=9222`, `--user-data-dir=${profilePath()}`], { detached: true, stdio: "ignore", windowsHide: false });
  child.unref();
  console.log(browser.kind === "edge" ? "Browser: Microsoft Edge" : "Browser: Google Chrome (fallback)");
  console.log("BROWSER_STARTED remoteDebuggingPort=9222");
  console.log("사용자가 브라우저에서 네이버 로그인 후 블로그 글쓰기 화면을 직접 열어야 합니다.");
}
async function connectEditor() {
  const browser = await chromium.connectOverCDP(cdpUrl);
  const pages = [];
  for (const context of browser.contexts()) for (const page of context.pages()) {
    if (/blog\.naver\.com/i.test(page.url()) && await page.locator('[contenteditable="true"]').count().catch(() => 0)) pages.push(page);
  }
  if (!pages.length) throw new Error("NAVER_EDITOR_NOT_OPEN");
  if (pages.length !== 1) throw new Error("MULTIPLE_NAVER_EDITORS");
  return { browser, page: pages[0] };
}
async function fill() {
  const packet = await loadPacket(packetPath);
  const previous = await readFile(statePath, "utf8").then(JSON.parse).catch(() => null);
  if (previous?.status === "READY_FOR_MANUAL_REVIEW") throw new Error("ALREADY_FILLED_REVIEW_REQUIRED");
  const { browser, page } = await connectEditor();
  const title = page.getByRole("textbox", { name: /제목/ }).first();
  if (!await title.count()) throw new Error("EDITOR_NOT_FOUND");
  await title.fill(packet.title);
  const editor = page.locator('[contenteditable="true"]').first();
  if (!await editor.count()) throw new Error("EDITOR_STRUCTURE_CHANGED");
  for (const block of packet.blocks) {
    if (block.type === "heading" || block.type === "paragraph") await editor.fill(`${await editor.inputValue().catch(() => "")}\n${block.text}`);
    if (block.type === "image") {
      const absolute = path.resolve(path.dirname(packetPath), block.file);
      await editor.fill(`${await editor.inputValue().catch(() => "")}\n[이미지 삽입 필요] ${block.caption}`);
      console.log(`IMAGE_UPLOAD_PENDING ${path.basename(absolute)}`);
    }
  }
  await writeState("READY_FOR_MANUAL_REVIEW");
  console.log("READY_FOR_MANUAL_REVIEW");
}

try {
  if (command === "check") await check();
  else if (command === "browser" || command === "open") await launchBrowser();
  else if (command === "check-editor") { await connectEditor(); console.log("EDITOR_OPENED"); }
  else if (command === "fill") await fill();
  else throw new Error("Usage: check | open | fill");
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
