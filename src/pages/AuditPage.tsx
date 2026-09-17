import { format, subDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { formatAuditAction, formatAuditTarget } from "../domain/presentation";
import { listAuditLogs } from "../services/audit";
import type { AuditLog } from "../types/domain";

function sourceLabel(source: AuditLog["source"]) { return source === "excel" ? "Excel" : source === "system" ? "\uC2DC\uC2A4\uD15C" : "\uC218\uB3D9"; }

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [start, setStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [end, setEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [targetType, setTargetType] = useState("");
  const [source, setSource] = useState("");
  useEffect(() => { void listAuditLogs(new Date(`${start}T00:00:00`), new Date(`${end}T23:59:59.999`)).then(setLogs); }, [start, end]);
  const filtered = useMemo(() => logs.filter((log) => (!actor || log.actorName.toLowerCase().includes(actor.toLowerCase())) && (!action || log.action === action) && (!targetType || log.targetType === targetType) && (!source || log.source === source)), [logs, actor, action, targetType, source]);
  const actions = [...new Set(logs.map((log) => log.action))].sort();
  const targets = [...new Set(logs.map((log) => log.targetType))].sort();
  return <><header className="page-header"><div><div className="eyebrow">{"\uAC10\uC0AC \uAE30\uB85D"}</div><h2>{"\uBCC0\uACBD \uAE30\uB85D"}</h2></div></header>
    <section className="card filter-grid"><label>{"\uC2DC\uC791\uC77C"}<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>{"\uC885\uB8CC\uC77C"}<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>{"\uC0AC\uC6A9\uC790"}<input value={actor} onChange={(event) => setActor(event.target.value)} /></label><label>{"\uC791\uC5C5"}<select value={action} onChange={(event) => setAction(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{actions.map((value) => <option key={value} value={value}>{formatAuditAction(value)}</option>)}</select></label><label>{"\uB300\uC0C1 \uC720\uD615"}<select value={targetType} onChange={(event) => setTargetType(event.target.value)}><option value="">{"\uC804\uCCB4"}</option>{targets.map((value) => <option key={value} value={value}>{formatAuditTarget(value)}</option>)}</select></label><label>{"\uC6D0\uBCF8"}<select value={source} onChange={(event) => setSource(event.target.value)}><option value="">{"\uC804\uCCB4"}</option><option value="manual">{"\uC218\uB3D9"}</option><option value="excel">Excel</option><option value="system">{"\uC2DC\uC2A4\uD15C"}</option></select></label><button onClick={() => { setActor(""); setAction(""); setTargetType(""); setSource(""); }}>{"\uCD08\uAE30\uD654"}</button></section>
    <section className="card"><div className="section-title-row"><h3>{filtered.length}{"\uAC1C \uAE30\uB85D"}</h3></div><div className="table-wrap"><table><thead><tr><th>{"\uC2DC\uAC04"}</th><th>{"\uC791\uC5C5\uC790"}</th><th>{"\uC791\uC5C5"}</th><th>{"\uB300\uC0C1"}</th><th>{"\uC6D0\uBCF8"}</th></tr></thead><tbody>{filtered.map((log) => <tr key={log.id}><td>{log.timestamp && "toDate" in (log.timestamp as object) ? (log.timestamp as { toDate(): Date }).toDate().toLocaleString("ko-KR") : "-"}</td><td>{log.actorName}</td><td>{formatAuditAction(log.action)}</td><td>{formatAuditTarget(log.targetType)}</td><td>{sourceLabel(log.source)}</td></tr>)}</tbody></table></div></section>
  </>;
}
