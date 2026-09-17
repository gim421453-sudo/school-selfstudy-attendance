import type { Period, SelfStudyException } from "../types/domain";

/** Existing periods without this field keep the former Monday-Saturday schedule. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const DEFAULT_OPERATING_DAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6];
export const NON_OPERATING_PERIOD_MESSAGE = "\uC120\uD0DD\uD55C \uAD50\uC2DC\uB294 \uD574\uB2F9 \uB0A0\uC9DC\uC5D0 \uC6B4\uC601\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
export const SUNDAY_SELF_STUDY_MESSAGE = "\uC77C\uC694\uC77C\uC740 \uC790\uC728\uD559\uC2B5 \uC6B4\uC601\uC77C\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
export const SUNDAY_DUTY_MESSAGE = "\uC77C\uC694\uC77C\uC740 \uC790\uC728\uD559\uC2B5 \uC6B4\uC601\uC77C\uC774 \uC544\uB2C8\uBBC0\uB85C \uB2F4\uB2F9\uAD50\uC0AC\uB97C \uC9C0\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";

/** Legacy periods did not distinguish breaks and remain self-study periods. */
export function periodTypeOf(period: Pick<Period, "periodType">): "SELF_STUDY" | "BREAK" {
  return period.periodType === "BREAK" ? "BREAK" : "SELF_STUDY";
}

export function isSelfStudyPeriod(period: Pick<Period, "periodType">): boolean {
  return periodTypeOf(period) === "SELF_STUDY";
}

function dateAtNoon(value: string | Date): Date {
  return typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
}

/** Legacy date-level flows retain their former Monday-Saturday default. */
export function isSelfStudyDay(date: string | Date): boolean {
  return dateAtNoon(date).getDay() !== 0;
}

type SchedulePeriod = Pick<Period, "operatingDays"> & Partial<Pick<Period, "name" | "order" | "periodType" | "scheduleByDay" | "startTime" | "endTime">>;
type TimedSchedulePeriod = SchedulePeriod & Pick<Period, "startTime" | "endTime">;

function legacyOperatingOn(period: Pick<Period, "operatingDays">, day: number): boolean {
  return day >= 0 && day <= 6 && (period.operatingDays?.length ? period.operatingDays : DEFAULT_OPERATING_DAYS).some((operatingDay) => operatingDay === day);
}

function periodEnabledForDay(period: SchedulePeriod, day: number) {
  const override = period.scheduleByDay?.[String(day)];
  return { enabled: override?.enabled ?? legacyOperatingOn(period, day), periodType: override?.periodType ?? periodTypeOf(period) };
}

export function operatingDaysFor(period: SchedulePeriod): readonly number[] {
  return Array.from({ length: 7 }, (_, day) => day).filter((day) => periodEnabledForDay(period, day).enabled);
}

export function isPeriodOperatingOn(date: string | Date, period: SchedulePeriod): boolean {
  const day = dateAtNoon(date).getDay();
  const schedule = periodEnabledForDay(period, day);
  return schedule.enabled && isSelfStudyPeriod(schedule);
}

export function periodScheduleForDay(period: TimedSchedulePeriod, day: number) {
  const override = period.scheduleByDay?.[String(day)];
  return { enabled: override?.enabled ?? legacyOperatingOn(period, day), name: override?.name ?? period.name ?? "", order: override?.order ?? period.order ?? 0, periodType: override?.periodType ?? periodTypeOf(period), startTime: override?.startTime ?? period.startTime, endTime: override?.endTime ?? period.endTime };
}

export function periodScheduleForDate(period: TimedSchedulePeriod, date: string | Date) {
  return periodScheduleForDay(period, dateAtNoon(date).getDay());
}

export function isSelfStudyDate(date: string | Date, exception?: Pick<SelfStudyException, "enabled"> | null): boolean {
  return isSelfStudyDay(date) && !exception?.enabled;
}

/** Scoped self-study decisions are period-aware; this helper evaluates exceptions only. */
export function isScopedSelfStudyDate(_date: string | Date, exceptions: Array<Pick<SelfStudyException, "active" | "enabled">>): boolean {
  return !exceptions.some((exception) => exception.active === true || (exception.active === undefined && exception.enabled === true));
}

export function assertSelfStudyDay(date: string): void {
  if (!isSelfStudyDay(date)) throw new Error(SUNDAY_SELF_STUDY_MESSAGE);
}

export function assertDutyDay(date: string): void {
  if (!isSelfStudyDay(date)) throw new Error(SUNDAY_DUTY_MESSAGE);
}
