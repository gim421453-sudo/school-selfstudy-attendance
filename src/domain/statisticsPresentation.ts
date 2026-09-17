export type StatisticsAggregate = "all" | "class" | "group" | "period" | "student";

function periodLabel(startDate: string, endDate: string, mode: string) {
  if (mode === "month" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) return `${startDate.slice(0, 4)}\uB144 ${Number(startDate.slice(5, 7))}\uC6D4`;
  if (mode === "day") return startDate;
  return startDate === endDate ? startDate : `${startDate} ~ ${endDate}`;
}

export function statisticsHeading(input: { startDate: string; endDate: string; mode: string; gradeName?: string; className?: string }) {
  const scope = input.className ?? input.gradeName ?? "\uC804\uCCB4";
  return `${periodLabel(input.startDate, input.endDate, input.mode)} \u00B7 ${scope} \uCD9C\uACB0 \uD604\uD669`;
}

export function statisticsAggregateHeading(aggregate: StatisticsAggregate) {
  return ({
    all: "\uC804\uCCB4 \uCD9C\uACB0 \uD1B5\uACC4",
    class: "\uD559\uAE09\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4",
    group: "\uC790\uC2B5\uADF8\uB8F9\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4",
    period: "\uAD50\uC2DC\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4",
    student: "\uD559\uC0DD\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4",
  } satisfies Record<StatisticsAggregate, string>)[aggregate];
}
