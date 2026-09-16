import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { assignHomeroom, listClasses, saveClassRoom } from "../services/classes";
import { listUsers } from "../services/users";
import type { AppUser, ClassRoom } from "../types/domain";

export function ClassesPage() {
  const { appUser } = useAuth();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [grade, setGrade] = useState(2);
  const [classNo, setClassNo] = useState(1);
  const [displayName, setDisplayName] = useState("2-1");

  async function refresh() {
    const [c, u] = await Promise.all([listClasses(), listUsers()]);
    setClasses(c);
    setUsers(u.filter((x) => x.active));
  }
  useEffect(() => { void refresh(); }, []);

  async function createClass(e: FormEvent) {
    e.preventDefault();
    const id = `${grade}-${classNo}`;
    if (!appUser) return;
    await saveClassRoom({ id, grade, classNo, displayName: displayName || id, active: true }, { uid: appUser.uid, name: appUser.displayName }, classes.find((classRoom) => classRoom.id === id) ?? null);
    await refresh();
  }

  async function changeHomeroom(classRoom: ClassRoom, teacherUid: string) {
    if (!appUser) return;
    const teacher = teacherUid ? users.find((u) => u.uid === teacherUid) ?? null : null;
    await assignHomeroom({
      classRoom,
      teacher,
      allClasses: classes,
      allUsers: users,
      actor: { uid: appUser.uid, name: appUser.displayName },
    });
    await refresh();
  }

  return (
    <>
      <header className="page-header"><div><div className="eyebrow">CLASS / HOMEROOM</div><h2>반·담임 관리</h2></div></header>
      <div className="grid two">
        <form className="card" onSubmit={createClass}>
          <h3>반 등록</h3>
          <label>학년<input type="number" min={1} max={3} value={grade} onChange={(e) => setGrade(Number(e.target.value))} /></label>
          <label>반<input type="number" min={1} value={classNo} onChange={(e) => setClassNo(Number(e.target.value))} /></label>
          <label>표시명<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
          <button className="primary">반 저장</button>
        </form>
        <section className="card">
          <h3>담임 연결 원칙</h3>
          <p>담임 지정 시 <code>classes</code>와 해당 교사 계정의 <code>homeroomClassId</code>를 함께 갱신합니다.</p>
          <p className="muted">통계를 담임에게 허용할 경우 이 값을 기준으로 본인 반 범위를 제한합니다.</p>
        </section>
      </div>
      <section className="card">
        <h3>반별 담임 계정</h3>
        <div className="table-wrap">
          <table>
            <thead><tr><th>반</th><th>학년</th><th>담임 이름</th><th>연결 계정</th></tr></thead>
            <tbody>{classes.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.displayName}</strong></td><td>{c.grade}</td><td>{c.homeroomTeacherName ?? "미지정"}</td>
                <td>
                  <select value={c.homeroomTeacherUid ?? ""} onChange={(e) => void changeHomeroom(c, e.target.value)}>
                    <option value="">담임 계정 선택</option>
                    {users.map((u) => <option key={u.uid} value={u.uid}>{u.displayName} · {u.email}</option>)}
                  </select>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}
