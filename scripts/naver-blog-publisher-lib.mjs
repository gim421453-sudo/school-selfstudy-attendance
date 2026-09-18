import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { access as fsAccess } from "node:fs/promises";

export const allowedImageFiles = new Set([
  "01-dashboard.png",
  "02-attendance-list.png",
  "06-staff-assignment.png",
  "07-mobile-sidebar.png",
]);

export async function loadPacket(packetPath) {
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  if (packet.schemaVersion !== 1 || packet.reviewRequired !== true || !packet.title || !Array.isArray(packet.blocks)) throw new Error("PUBLISH_PACKET_INVALID");
  const root = path.dirname(packetPath);
  for (const block of packet.blocks) {
    if (block.type !== "image") continue;
    if (block.publishCandidate !== true || block.requiresRedaction !== false) throw new Error("SENSITIVE_CONTENT_BLOCKED");
    if (!allowedImageFiles.has(path.basename(block.file))) throw new Error("PUBLISH_PACKET_INVALID");
    const absolute = path.resolve(root, block.file);
    await access(absolute);
    if (!absolute.toLowerCase().endsWith(".png")) throw new Error("PUBLISH_PACKET_INVALID");
  }
  return packet;
}

export function profilePath(env = process.env) {
  const base = env.LOCALAPPDATA;
  if (!base) throw new Error("LOCALAPPDATA_NOT_FOUND");
  return path.join(base, "SchoolSelfStudyDevlog", "NaverBlogProfile");
}

export async function findInstalledBrowser(env = process.env) {
  const local = env.LOCALAPPDATA || "";
  const candidates = [
    ["edge", path.join(env.PROGRAMFILES || "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe")],
    ["edge", path.join(env.PROGRAMFILES_X86 || "C:\\Program Files (x86)", "Microsoft", "Edge", "Application", "msedge.exe")],
    ["chrome", path.join(env.PROGRAMFILES || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe")],
    ["chrome", path.join(local, "Google", "Chrome", "Application", "chrome.exe")],
  ];
  for (const [kind, executable] of candidates) { try { await fsAccess(executable); return { kind, executable }; } catch {} }
  throw new Error("BROWSER_NOT_FOUND");
}

export function uniqueTags(tags) { return [...new Set((tags ?? []).filter((tag) => typeof tag === "string" && tag.trim()).map((tag) => tag.trim()))]; }
