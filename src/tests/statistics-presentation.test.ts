import { describe, expect, it } from "vitest";
import { statisticsAggregateHeading, statisticsHeading } from "../domain/statisticsPresentation";

describe("statistics presentation", () => {
  it("uses the selected month and class in the visible heading", () => {
    expect(statisticsHeading({ startDate: "2026-09-01", endDate: "2026-09-30", mode: "month", className: "2\uD559\uB144 1\uBC18" })).toBe("2026\uB144 9\uC6D4 \u00B7 2\uD559\uB144 1\uBC18 \uCD9C\uACB0 \uD604\uD669");
  });

  it("labels each aggregate table without exposing an internal key", () => {
    expect(statisticsAggregateHeading("class")).toBe("\uD559\uAE09\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4");
    expect(statisticsAggregateHeading("group")).toBe("\uC790\uC2B5\uADF8\uB8F9\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4");
    expect(statisticsAggregateHeading("period")).toBe("\uAD50\uC2DC\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4");
    expect(statisticsAggregateHeading("student")).toBe("\uD559\uC0DD\uBCC4 \uCD9C\uACB0 \uD1B5\uACC4");
  });
});
