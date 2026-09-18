let lastPacket = null;

function isEditorTab() {
  return /^https:\/\/(www\.|m\.)?blog\.naver\.com\//i.test(location.href);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "DEVLOG_PACKET_READY") return;
  if (!isEditorTab()) { console.warn("NAVER_EDITOR_NOT_OPEN"); return; }
  lastPacket = message.packet;
  document.documentElement.dataset.devlogPacketState = "READY_FOR_MANUAL_REVIEW";
  console.info("DEVLOG_PACKET_READY", { date: lastPacket.date, blocks: lastPacket.blocks?.length ?? 0 });
  // 실제 SmartEditor 입력은 다음 단계에서 editor DOM 확인 후 구현합니다.
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DEVLOG_INSPECT_EDITOR") return;
  sendResponse({ detected: isEditorTab(), url: location.href });
});
