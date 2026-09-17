export interface SupervisionCalendarCell {
  date: string | null;
  day: number | null;
}

export const SUPERVISION_CALENDAR_WEEKDAYS = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"] as const;

function parseMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) throw new Error("Invalid month");
  return { year, monthNumber };
}

function dateString(month: string, day: number) {
  return `${month}-${String(day).padStart(2, "0")}`;
}

/** Builds local calendar-date strings without UTC conversion or timezone shifts. */
export function supervisionCalendarCells(month: string): SupervisionCalendarCell[] {
  const { year, monthNumber } = parseMonth(month);
  const firstDay = new Date(year, monthNumber - 1, 1).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.max(35, Math.ceil((firstDay + daysInMonth) / 7) * 7);

  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDay + 1;
    return day >= 1 && day <= daysInMonth ? { date: dateString(month, day), day } : { date: null, day: null };
  });
}

export function shiftSupervisionCalendarMonth(month: string, offset: number) {
  const { year, monthNumber } = parseMonth(month);
  const total = year * 12 + (monthNumber - 1) + offset;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12 + 12) % 12 + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}
