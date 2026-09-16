import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { isGradeAdmin } from "../domain/access";
import { getDutyAssignment } from "../services/duty";
import type { DutyAssignment } from "../types/domain";

export function DashboardPage() {
  const { appUser } = useAuth(); const today = format(new Date(), "yyyy-MM-dd"); const [duty, setDuty] = useState<DutyAssignment | null>(null);
  useEffect(() => { void getDutyAssignment(today).then(setDuty); }, [today]);
  const assignedPeriods = Object.values(duty?.periods ?? {}); const editable = isGradeAdmin(appUser) || assignedPeriods.some((assignment) => assignment.teacherUid === appUser?.uid);
  const names = assignedPeriods.map((assignment) => assignment.teacherName).filter((value, index, all) => all.indexOf(value) === index).join(", ");
  return <><header className="page-header"><div><div className="eyebrow">{format(new Date(), "yyyy\uB144 M\uC6D4 d\uC77C EEEE", { locale: ko })}</div><h2>{"\uB300\uC2DC\uBCF4\uB4DC"}</h2></div><span className={`status-pill ${editable ? "success" : ""}`}>{editable ? "\uCD9C\uACB0 \uC785\uB825 \uAC00\uB2A5" : "\uC870\uD68C \uC804\uC6A9"}</span></header><section className="hero-card"><div><span className="muted">{"\uC624\uB298 \uB2F4\uB2F9 \uAD50\uC0AC"}</span><h3>{names || "\uBBF8\uBC30\uC815"}</h3><p>{"\uAD50\uC2DC\uBCC4 \uB2F4\uB2F9 \uBC30\uC815\uC740 \uCD9C\uACB0 \uC785\uB825 \uAD8C\uD55C\uC744 \uACB0\uC815\uD569\uB2C8\uB2E4."}</p></div><div className="big-number">{today.slice(5).replace("-", "/")}</div></section></>;
}
