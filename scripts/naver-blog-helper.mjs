import http from "node:http";
import path from "node:path";
import { readFile, stat } from "node:fs/promises";

const root = process.cwd();
const publishRoot = path.join(root, "개발일지", "자습 출결관리", "publish");
const assetsRoot = path.join(root, "개발일지", "자습 출결관리", "assets");
const port = 43127;
const safePath = (base, value) => { const resolved = path.resolve(base, value); return resolved.startsWith(`${path.resolve(base)}${path.sep}`) ? resolved : null; };
const json = (response, status, value) => { response.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "http://127.0.0.1:43127" }); response.end(JSON.stringify(value)); };

const server = http.createServer(async (request, response) => {
  if (request.socket.remoteAddress !== "127.0.0.1" && request.socket.remoteAddress !== "::1") return json(response, 403, { error: "LOCAL_ONLY" });
  if (request.method !== "GET") return json(response, 405, { error: "METHOD_NOT_ALLOWED" });
  if (request.url === "/health") return json(response, 200, { ok: true, service: "naver-devlog-helper" });
  if (request.url === "/packet/latest") {
    try {
      const dates = await (await import("node:fs/promises")).readdir(publishRoot, { withFileTypes: true });
      const date = process.env.DEVLOG_DATE || dates.filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name)).map((entry) => entry.name).sort().at(-1);
      if (!date) return json(response, 404, { error: "PUBLISH_PACKET_NOT_FOUND" });
      const packetPath = path.join(publishRoot, date, "naver-post.json");
      const packet = JSON.parse(await readFile(packetPath, "utf8"));
      const blocks = packet.blocks.filter((block) => block.type !== "image" || block.publishCandidate === true && block.requiresRedaction === false);
      return json(response, 200, { ...packet, blocks });
    } catch { return json(response, 404, { error: "PUBLISH_PACKET_NOT_FOUND" }); }
  }
  const match = request.url?.match(/^\/asset\/([\w-]+)\/screenshots\/(01-dashboard|02-attendance-list|06-staff-assignment|07-mobile-sidebar)\.png$/);
  if (match) {
    const file = safePath(assetsRoot, `${match[1]}/screenshots/${match[2]}.png`);
    try { const body = await readFile(file); response.writeHead(200, { "content-type": "image/png", "cache-control": "no-store" }); response.end(body); } catch { json(response, 404, { error: "ASSET_NOT_FOUND" }); }
    return;
  }
  json(response, 404, { error: "NOT_FOUND" });
});

server.listen(port, "127.0.0.1", () => console.log(`NAVER_DEVLOG_HELPER_READY http://127.0.0.1:${port}`));
