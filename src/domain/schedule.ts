export const SUNDAY_SELF_STUDY_MESSAGE = "\uC77C\uC694\uC77C\uC740 \uC790\uC728\uD559\uC2B5 \uC6B4\uC601\uC77C\uC774 \uC544\uB2D9\uB2C8\uB2E4.";
export const SUNDAY_DUTY_MESSAGE = "\uC77C\uC694\uC77C\uC740 \uC790\uC728\uD559\uC2B5 \uC6B4\uC601\uC77C\uC774 \uC544\uB2C8\uBBC0\uB85C \uB2F4\uB2F9\uAD50\uC0AC\uB97C \uC9C0\uC815\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";

function dateAtNoon(value: string | Date): Date {
  return typeof value === "string" ? new Date(`${value}T12:00:00`) : value;
}

export function isSelfStudyDay(date: string | Date): boolean {
  return dateAtNoon(date).getDay() !== 0;
}

export function isSelfStudyDate(date: string | Date, exception?: Pick<import("../types/domain").SelfStudyException, "enabled"> | null): boolean {
  return isSelfStudyDay(date) && !exception?.enabled;
}

export function assertSelfStudyDay(date: string): void {
  if (!isSelfStudyDay(date)) throw new Error(SUNDAY_SELF_STUDY_MESSAGE);
}

export function assertDutyDay(date: string): void {
  if (!isSelfStudyDay(date)) throw new Error(SUNDAY_DUTY_MESSAGE);
}
