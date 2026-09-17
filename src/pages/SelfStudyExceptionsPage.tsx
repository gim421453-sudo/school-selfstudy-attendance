import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { safeLoadError } from "../domain/presentation";
import { isGradeAdminForGrade, isSystemOwner } from "../domain/scope";
import { listScopedPeriods, type ScopedPeriod } from "../services/scopedPeriods";
import { deactivateSelfStudyException, listSelfStudyExceptions, saveSelfStudyException } from "../services/selfStudyExceptions";
import { useScope } from "../scope/ScopeProvider";
import type { SelfStudyException, SelfStudyExceptionReasonType } from "../types/domain";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function SelfStudyExceptionsPage() {
  const { appUser } = useAuth(); const { scope, assignments, grades } = useScope();
  const owner = isSystemOwner(appUser); const ownerGrades = scope ? grades.filter((grade) => grade.academicYearId === scope.academicYearId && grade.active) : [];
  const [ownerGradeId, setOwnerGradeId] = useState(""); const selectedGradeId = owner ? (ownerGradeId || scope?.gradeId || ownerGrades[0]?.id) : scope?.gradeId;
  const current = scope && selectedGradeId ? { academicYearId: scope.academicYearId, gradeId: selectedGradeId } : null;
  const admin = Boolean(appUser && current && isGradeAdminForGrade(assignments, appUser.uid, current.academicYearId, current.gradeId)); const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;
  const [items, setItems] = useState<SelfStudyException[]>([]); const [periods, setPeriods] = useState<ScopedPeriod[]>([]); const [periodIds, setPeriodIds] = useState<string[]>([]);
  const [date, setDate] = useState(today()); const [scopeType, setScopeType] = useState<"school" | "grade">("grade"); const [reasonType, setReasonType] = useState<SelfStudyExceptionReasonType>("manual"); const [reason, setReason] = useState(""); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function refresh() { if (!current) return; const [nextItems, nextPeriods] = await Promise.all([listSelfStudyExceptions(current), listScopedPeriods(current.academicYearId, current.gradeId)]); setItems(nextItems); setPeriods(nextPeriods); }
  useEffect(() => { if (owner && !ownerGradeId && ownerGrades[0]) setOwnerGradeId(ownerGrades[0].id); }, [owner, ownerGradeId, ownerGrades]);
  useEffect(() => { void refresh().catch((caught) => setError(safeLoadError("selfStudyExceptions", caught))); }, [current?.academicYearId, current?.gradeId]);
  function duplicateMessage(targetGradeId: string | null) {
    const existing = items.find((item) => item.active !== false && item.date === date && item.scopeType === scopeType && item.gradeId === targetGradeId);
    if (!existing) return null;
    const existingPeriodIds = existing.periodIds ?? [];
    if (periodIds.length === 0 && existingPeriodIds.length === 0) return "\uC774\uBBF8 \uAC19\uC740 \uB0A0\uC9DC\uC640 \uC801\uC6A9 \uBC94\uC704\uC758 \uC790\uC2B5 \uC81C\uC678\uC77C\uC774 \uB4F1\uB85D\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.";
    if (periodIds.some((periodId) => existingPeriodIds.includes(periodId))) return "\uC774\uBBF8 \uD574\uB2F9 \uB0A0\uC9DC\uC640 \uAD50\uC2DC\uC5D0 \uC790\uC2B5 \uC81C\uC678\uC77C\uC774 \uB4F1\uB85D\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.";
    return null;
  }
  async function save() { if (!current || !actor || busy) return; setBusy(true); try { setError(null); if (!owner && scopeType === "school") throw new Error("\uD559\uAD50 \uC804\uCCB4 \uC608\uC678\uC77C\uC740 \uCD5C\uACE0\uAD00\uB9AC\uC790\uB9CC \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."); const gradeId = scopeType === "grade" ? current.gradeId : null; const duplicate = duplicateMessage(gradeId); if (duplicate) throw new Error(duplicate); await saveSelfStudyException({ academicYearId: current.academicYearId, gradeId, scopeType, date, reasonType, reason, active: true, ...(periodIds.length ? { periodIds } : {}) }, actor); setReason(""); setPeriodIds([]); await refresh(); } catch (caught) { setError(caught instanceof Error ? caught.message : "\uC608\uC678\uC77C\uC744 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."); } finally { setBusy(false); } }
  if (!current) return <section className="empty-state"><h2>{"\uAD00\uB9AC\uD560 \uD559\uB144\uC744 \uC120\uD0DD\uD558\uC138\uC694."}</h2></section>;
  if (!owner && !admin) return <section className="empty-state"><h2>{"\uC608\uC678\uC77C \uAD00\uB9AC \uAD8C\uD55C\uC774 \uD544\uC694\uD569\uB2C8\uB2E4."}</h2></section>;
  return <><header className="page-header"><div><div className="eyebrow">{"\uC790\uC2B5 \uC6B4\uC601 \uC608\uC678\uC77C"}</div><h2>{"\uC790\uC2B5 \uC6B4\uC601 \uC608\uC678\uC77C"}</h2></div>{owner && <label>{"\uAD00\uB9AC \uD559\uB144"}<select value={selectedGradeId ?? ""} onChange={(event) => setOwnerGradeId(event.target.value)}>{ownerGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.displayName}</option>)}</select></label>}</header>{error && <div className="empty-state text-danger">{error}</div>}
    <section className="card filter-grid"><label>{"\uB0A0\uC9DC"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>{"\uBC94\uC704"}<select value={scopeType} disabled={!owner} onChange={(event) => setScopeType(event.target.value as "school" | "grade")}><option value="grade">{"\uC120\uD0DD \uD559\uB144"}</option>{owner && <option value="school">{"\uD559\uAD50 \uC804\uCCB4"}</option>}</select></label><label>{"\uC720\uD615"}<select value={reasonType} onChange={(event) => setReasonType(event.target.value as SelfStudyExceptionReasonType)}><option value="holiday">{"\uACF5\uD734\uC77C"}</option><option value="exam">{"\uC2DC\uD5D8"}</option><option value="school_event">{"\uD559\uAD50\uD589\uC0AC"}</option><option value="manual">{"\uC218\uB3D9"}</option></select></label><label>{"\uC0AC\uC720"}<input value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy} onClick={() => void save()}>{"\uC800\uC7A5"}</button></section>
    <section className="card"><h3>{"\uC81C\uC678 \uAD50\uC2DC"}</h3><p className="muted">{"\uC120\uD0DD\uD558\uC9C0 \uC54A\uC73C\uBA74 \uC885\uC77C \uC81C\uC678\uC785\uB2C8\uB2E4. \uC120\uD0DD\uD55C \uAD50\uC2DC\uB9CC \uC81C\uC678\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}</p>{periods.filter((period) => period.active).map((period) => <label key={period.id}><input type="checkbox" checked={periodIds.includes(period.id)} onChange={() => setPeriodIds((ids) => ids.includes(period.id) ? ids.filter((id) => id !== period.id) : [...ids, period.id])} /> {period.name}</label>)}</section>
    <section className="card table-wrap"><table><thead><tr><th>{"\uB0A0\uC9DC"}</th><th>{"\uBC94\uC704"}</th><th>{"\uAD50\uC2DC"}</th><th>{"\uC0AC\uC720"}</th><th>{"\uC0C1\uD0DC"}</th><th /></tr></thead><tbody>{items.map((item) => <tr key={`${item.scopeType}_${item.gradeId}_${item.date}`}><td>{item.date}</td><td>{item.scopeType === "school" ? "\uD559\uAD50 \uC804\uCCB4" : ownerGrades.find((grade) => grade.id === item.gradeId)?.displayName ?? "\uC120\uD0DD \uD559\uB144"}</td><td>{item.periodIds?.map((id) => periods.find((period) => period.id === id)?.name ?? "\uC0AD\uC81C\uB41C \uAD50\uC2DC").join(", ") || "\uC885\uC77C"}</td><td>{item.reason}</td><td>{item.active === false ? "\uBE44\uD65C\uC131" : "\uD65C\uC131"}</td><td>{item.active !== false && <button className="small" onClick={() => actor && void deactivateSelfStudyException(item, actor).then(refresh)}>{"\uBE44\uD65C\uC131\uD654"}</button>}</td></tr>)}</tbody></table></section>
  </>;
}
