import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { getAccessSettings, saveAccessSettings } from "../services/settings";
import { listUsers, updateUserAccount } from "../services/users";
import { approvePendingUser, listPendingUsers, rejectPendingUser } from "../services/pendingUsers";
import type { AccessSettings, AppUser, PendingUser, UserRole } from "../types/domain";

export function AdminPage() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [settings, setSettings] = useState<AccessSettings | null>(null);
  const [search, setSearch] = useState("");
  const actor = appUser ? { uid: appUser.uid, name: appUser.displayName } : null;
  async function refreshUsers() { setUsers(await listUsers()); }
  async function refreshPending() { setPendingUsers(await listPendingUsers()); }
  useEffect(() => { void refreshUsers(); void refreshPending(); void getAccessSettings().then(setSettings); }, []);
  async function toggleStats() {
    if (!settings || !actor) return;
    const next = { ...settings, statsVisibility: settings.statsVisibility === "grade_admin_only" ? "grade_admin_and_homeroom" : "grade_admin_only" } as AccessSettings;
    await saveAccessSettings(next, actor, settings);
    setSettings(next);
  }
  async function setActive(user: AppUser) {
    if (!actor) return;
    await updateUserAccount(user, { active: !user.active }, actor);
    await refreshUsers();
  }
  async function setBaseRole(user: AppUser, mode: "teacher" | "grade_admin") {
    if (!actor) return;
    const preserved = user.roles.filter((role) => role === "system_owner" || role === "homeroom_teacher");
    const roles: UserRole[] = [...preserved, "teacher", ...(mode === "grade_admin" ? ["grade_admin"] as UserRole[] : [])];
    await updateUserAccount(user, { roles }, actor);
    await refreshUsers();
  }
  async function approve(pending: PendingUser, role: "teacher" | "grade_admin") { if (!actor) return; await approvePendingUser(pending, role, actor); await Promise.all([refreshUsers(), refreshPending()]); }
  async function reject(pending: PendingUser) { if (!actor) return; await rejectPendingUser(pending, actor); await refreshPending(); }
  const visible = useMemo(() => users.filter((user) => `${user.displayName} ${user.email}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  return <><header className="page-header"><div><div className="eyebrow">{"\uCD5C\uACE0 \uAD00\uB9AC\uC790"}</div><h2>{"\uACC4\uC815 \uAD00\uB9AC"}</h2></div></header>
    <div className="grid two"><section className="card"><h3>{"\uD1B5\uACC4 \uC5F4\uB78C \uAD8C\uD55C"}</h3><p><strong>{settings?.statsVisibility ?? "\uBD88\uB7EC\uC624\uB294 \uC911"}</strong></p><button onClick={() => void toggleStats()}>{"\uC815\uCC45 \uBCC0\uACBD"}</button></section><section className="card"><h3>{"\uAD50\uC9C1\uC6D0 \uACC4\uC815"}</h3><label>{"\uAC80\uC0C9"}<input value={search} onChange={(event) => setSearch(event.target.value)} /></label></section></div>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>{"\uC774\uB984"}</th><th>{"\uC774\uBA54\uC77C"}</th><th>{"\uC0C1\uD0DC"}</th><th>{"\uC5ED\uD560"}</th><th>{"\uB2F4\uC784"}</th><th>{"\uC791\uC5C5"}</th></tr></thead><tbody>{visible.map((user) => <tr key={user.uid}><td>{user.displayName}</td><td>{user.email}</td><td>{user.active ? "\uD65C\uC131" : "\uBE44\uD65C\uC131"}</td><td>{user.roles.join(", ")}</td><td>{user.homeroomClassId ?? "-"}</td><td>{user.roles.includes("system_owner") ? "-" : <><select value={user.roles.includes("grade_admin") ? "grade_admin" : "teacher"} onChange={(event) => void setBaseRole(user, event.target.value as "teacher" | "grade_admin")}><option value="teacher">{"\uAD50\uC0AC"}</option><option value="grade_admin">{"\uD559\uB144\uBD80 \uAD00\uB9AC\uC790"}</option></select><button className="small" onClick={() => void setActive(user)}>{user.active ? "\uBE44\uD65C\uC131\uD654" : "\uD65C\uC131\uD654"}</button></>}</td></tr>)}</tbody></table></div></section>
    <section className="card"><h3>{"\uC2B9\uC778 \uB300\uAE30 \uC0AC\uC6A9\uC790"}</h3><div className="table-wrap"><table><thead><tr><th>{"\uC774\uB984"}</th><th>{"\uC774\uBA54\uC77C"}</th><th>{"\uC2B9\uC778 \uC694\uCCAD"}</th><th>{"\uCD5C\uADFC \uB85C\uADF8\uC778"}</th><th>{"\uC791\uC5C5"}</th></tr></thead><tbody>{pendingUsers.map((pending) => <tr key={pending.uid}><td>{pending.displayName}</td><td>{pending.email}</td><td>{pending.createdAt && "toDate" in (pending.createdAt as object) ? (pending.createdAt as { toDate(): Date }).toDate().toLocaleString("ko-KR") : "-"}</td><td>{pending.lastLoginAt && "toDate" in (pending.lastLoginAt as object) ? (pending.lastLoginAt as { toDate(): Date }).toDate().toLocaleString("ko-KR") : "-"}</td><td><button className="small" onClick={() => void approve(pending, "teacher")}>{"\uC77C\uBC18 \uAD50\uC0AC\uB85C \uC2B9\uC778"}</button><button className="small" onClick={() => void approve(pending, "grade_admin")}>{"\uD559\uB144\uBD80\uB85C \uC2B9\uC778"}</button><button className="small" onClick={() => void reject(pending)}>{"\uC694\uCCAD \uAC70\uC808"}</button></td></tr>)}</tbody></table></div></section>
  </>;
}
