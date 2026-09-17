export function dateForMonth(month: string, currentDate: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  if (currentDate.startsWith(`${month}-`) && /^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return currentDate;
  return `${month}-01`;
}
