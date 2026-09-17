import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { periodScheduleForDate } from "../domain/schedule";
import { listScopedPeriods } from "../services/scopedPeriods";
import { listSelfStudyGroups, listSupervisionAssignments } from "../services/selfStudyOperations";
import { useScope } from "../scope/ScopeProvider";

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function MySupervisionPage() {
  const { appUser } = useAuth(); const { scope } = useScope();
  const [date, setDate] = useState(today()); const [periods, setPeriods] = useState<any[]>([]); const [groups, setGroups] = useState<any[]>([]); const [assignments, setAssignments] = useState<any[]>([]); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!scope?.gradeId || !appUser) return;
    const current = { academicYearId: scope.academicYearId, gradeId: scope.gradeId };
    void Promise.all([listScopedPeriods(current.academicYearId, current.gradeId), listSelfStudyGroups(current), listSupervisionAssignments(current, { date, teacherUid: appUser.uid })])
      .then(([nextPeriods, nextGroups, nextAssignments]) => { setPeriods(nextPeriods); setGroups(nextGroups); setAssignments(nextAssignments.filter((item) => item.active)); setError(null); })
      .catch(() => setError("\uAC10\uB3C5 \uC77C\uC815\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."));
  }, [scope?.academicYearId, scope?.gradeId, appUser?.uid, date]);
  const rows = useMemo(() => assignments.map((assignment) => ({ assignment, period: periods.find((item) => item.id === assignment.periodId), group: groups.find((item) => item.id === assignment.selfStudyGroupId) })).filter((item) => item.period?.active && item.group?.active).sort((left, right) => left.period.order - right.period.order || left.group.sortOrder - right.group.sortOrder), [assignments, groups, periods]);
  if (!scope?.gradeId) return <section className="empty-state"><h2>{"\uD559\uB144\uC744 \uC120\uD0DD\uD558\uC138\uC694."}</h2></section>;
  return <section><header className="page-header"><div><div className="eyebrow">{"\uB0B4 \uAC10\uB3C5 \uC5C5\uBB34"}</div><h2>{"\uAC10\uB3C5\uAD50\uC0AC \uC77C\uC815"}</h2><p className="muted">{"\uAC10\uB3C5\uAD50\uC0AC \uBC30\uC815 \uACB0\uACFC\uB97C \uAD50\uC0AC\uBCC4 \uC77C\uC815\uC73C\uB85C \uC870\uD68C\uD569\uB2C8\uB2E4. \uBCC4\uB3C4\uC758 \uAC10\uB3C5 \uC815\uBCF4\uB97C \uC0C8\uB85C \uC0DD\uC131\uD558\uB294 \uD654\uBA74\uC774 \uC544\uB2D9\uB2C8\uB2E4."}</p></div><label>{"\uB0A0\uC9DC"}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label></header>{error && <div className="empty-state text-danger">{error}</div>}<section className="card table-wrap"><table><thead><tr><th>{"\uB0A0\uC9DC"}</th><th>{"\uAD50\uC2DC"}</th><th>{"\uC2DC\uAC04"}</th><th>{"\uC790\uC2B5\uADF8\uB8F9"}</th></tr></thead><tbody>{rows.map(({ assignment, period, group }) => { const schedule = periodScheduleForDate(period, date); return <tr key={assignment.id}><td>{date}</td><td>{period.name}</td><td>{schedule.startTime} ~ {schedule.endTime}</td><td>{group.displayName}</td></tr>; })}</tbody></table>{rows.length === 0 && <div className="empty-state">{"\uC120\uD0DD\uD55C \uB0A0\uC9DC\uC5D0 \uBC30\uC815\uB41C \uAC10\uB3C5 \uC77C\uC815\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}</div>}</section></section>;
}
