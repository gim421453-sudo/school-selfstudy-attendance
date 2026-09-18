const HELPER = "http://127.0.0.1:43127";
const $ = (id) => document.getElementById(id);
let activeTab = null;
function setText(id, value) { if ($(id)) $(id).textContent = value; }
function isNaver(url) { return /^https:\/\/(www\.|m\.)?blog\.naver\.com\//i.test(url || ""); }
function showError(error) { if (!$('error')) return; $('error').hidden = false; $('error').textContent = error instanceof Error ? error.message : String(error); }
async function inspectEditor() {
  if (!activeTab?.id || !isNaver(activeTab.url)) { setText('statusCode', 'NAVER_EDITOR_NOT_OPEN'); return false; }
  try {
    const result = await chrome.runtime.sendMessage({ type: 'DEVLOG_INSPECT_ALL_FRAMES', tabId: activeTab.id });
    const frames = result?.frames || [];
    const roots = frames.filter((frame) => frame.editorRootDetected);
    const titleCount = roots.reduce((sum, frame) => sum + (frame.titleCandidateCount || 0), 0);
    const componentCount = roots.reduce((sum, frame) => sum + (frame.titleComponentCount || 0), 0);
    const textRootCount = roots.reduce((sum, frame) => sum + (frame.titleTextRootCount || 0), 0);
    const bodyCount = roots.reduce((sum, frame) => sum + (frame.bodyCandidateCount || 0), 0);
    const readyFrames = roots.filter((frame) => frame.titleCandidateCount === 1 && frame.bodyCandidateCount === 1);
    const status = !frames.length ? 'EDITOR_FRAME_NOT_REACHABLE' : !roots.length ? 'EDITOR_ROOT_NOT_FOUND' : readyFrames.length > 1 ? 'MULTIPLE_EDITOR_FRAMES' : !componentCount ? 'TITLE_COMPONENT_NOT_FOUND' : !textRootCount ? 'TITLE_TEXT_ROOT_NOT_FOUND' : !titleCount ? 'TITLE_EDIT_TARGET_NOT_FOUND' : !bodyCount ? 'BODY_EDITOR_NOT_FOUND' : titleCount > 1 ? 'MULTIPLE_TITLE_CANDIDATES' : readyFrames.length === 1 ? 'READY_FOR_FILL' : 'TITLE_BODY_COLLISION';
    const summary = frames.map((frame, index) => `#${index} ${frame.isTopFrame ? 'top' : 'child'} ${frame.originHostname || 'unknown'} ${frame.readyState || 'unknown'} body:${frame.bodyPresent ? 'yes' : 'no'} ce:${frame.domCounts?.contenteditableTrue || 0} se:${frame.structureCandidates?.seClass || 0}`).join(' | ');
    setText('frames', `Frames: ${frames.length} · Editor root: ${roots.length} · about:blank: ${frames.filter((frame) => frame.urlType === 'ABOUT_BLANK').length}${summary ? ` · ${summary}` : ''}`);
    const representative = roots.flatMap((frame) => frame.titleTextRootMeta || []).flatMap((item) => item.className || []).slice(0, 3).join(', ');
    setText('editor', `${roots.length ? 'Editor root detected' : 'Editor root not detected'} · title components ${componentCount} · title text roots ${textRootCount} · title edit targets ${titleCount} · body candidates ${bodyCount}${representative ? ` · ${representative}` : ''}`);
    setText('lastInspection', `Last inspection: ${new Date().toLocaleTimeString()}`);
    setText('statusCode', status);
    return status === 'READY_FOR_FILL';
  } catch { setText('statusCode', 'EDITOR_FRAME_NOT_REACHABLE'); return false; }
}
async function refresh() {
  if ($('error')) $('error').hidden = true;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true }); activeTab = tab;
  setText('tab', !isNaver(tab?.url) ? 'Unsupported page' : /write|post|editor/i.test(tab.url) ? 'Naver Blog write page' : 'Naver Blog page');
  try { const health = await fetch(`${HELPER}/health`); if (!health.ok) throw new Error('HELPER_NOT_READY'); setText('helper', 'Connected'); const response = await fetch(`${HELPER}/packet/latest`); if (!response.ok) throw new Error('PUBLISH_PACKET_NOT_FOUND'); const packet = await response.json(); setText('packet', 'Loaded'); setText('packetMeta', `${packet.title || ''} · images ${(packet.blocks || []).filter((block) => block.type === 'image').length}`); setText('statusCode', 'PACKET_READY'); } catch (error) { setText('helper', 'Disconnected'); setText('packet', 'Load failed'); showError(error); }
  await inspectEditor();
}
if ($('refresh')) $('refresh').addEventListener('click', () => void refresh());
if ($('inspect')) $('inspect').addEventListener('click', async () => { const button = $('inspect'); button.disabled = true; setText('statusCode', 'INSPECTION_IN_PROGRESS'); try { await inspectEditor(); } finally { button.disabled = false; } });
void refresh();
