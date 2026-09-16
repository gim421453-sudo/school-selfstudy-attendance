import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { listPeriods, savePeriod } from "../services/masterData";
import type { Period } from "../types/domain";

const copy = {
  title: "\uC790\uC728 \uAD50\uC2DC \uAD00\uB9AC",
  settings: "\uC790\uC728 \uAD50\uC2DC \uC124\uC815",
  add: "\uC0C8 \uAD50\uC2DC \uCD94\uAC00",
  edit: "\uAD50\uC2DC \uC218\uC815",
  order: "\uC21C\uC11C",
  name: "\uAD50\uC2DC\uBA85",
  start: "\uC2DC\uC791 \uC2DC\uAC04",
  end: "\uC885\uB8CC \uC2DC\uAC04",
  active: "\uD65C\uC131",
  inactive: "\uBE44\uD65C\uC131",
  save: "\uC800\uC7A5",
  cancel: "\uCDE8\uC18C",
  editButton: "\uC218\uC815",
  list: "\uAD50\uC2DC \uBAA9\uB85D",
};

const initialForm = { name: "\uC790\uC728 1\uAD50\uC2DC", order: 1, startTime: "18:00", endTime: "18:50", active: true };

export function PeriodsPage() {
  const { appUser } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState<Period | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() { setPeriods(await listPeriods()); }
  useEffect(() => { void refresh(); }, []);

  function edit(period: Period) {
    setEditing(period);
    setForm({ name: period.name, order: period.order, startTime: period.startTime, endTime: period.endTime, active: period.active });
    setError("");
  }

  function cancel() {
    setEditing(null);
    setForm(initialForm);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!appUser) return;
    setBusy(true);
    setError("");
    const period: Period = { id: editing?.id ?? `period-${crypto.randomUUID()}`, ...form, name: form.name.trim() };
    try {
      await savePeriod(period, { uid: appUser.uid, name: appUser.displayName }, editing);
      await refresh();
      cancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "\uAD50\uC2DC\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header"><div><div className="eyebrow">{copy.settings}</div><h2>{copy.title}</h2></div></header>
      <div className="grid two">
        <form className="card" onSubmit={submit}>
          <h3>{editing ? copy.edit : copy.add}</h3>
          <label>{copy.order}<input type="number" min={1} value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) })} /></label>
          <label>{copy.name}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
          <label>{copy.start}<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required /></label>
          <label>{copy.end}<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required /></label>
          <label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> {form.active ? copy.active : copy.inactive}</label>
          {error && <p className="text-danger">{error}</p>}
          <div className="button-row"><button className="primary" disabled={busy}>{copy.save}</button>{editing && <button type="button" className="small" onClick={cancel}>{copy.cancel}</button>}</div>
        </form>
        <section className="card">
          <h3>{copy.list}</h3>
          {periods.map((period) => (
            <div className="list-item" key={period.id}>
              <div><strong>{period.name}</strong><span className="muted"> {period.startTime} ~ {period.endTime} · {period.active ? copy.active : copy.inactive}</span></div>
              <button className="small" onClick={() => edit(period)}>{copy.editButton}</button>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
