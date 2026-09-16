import { describe, expect, it } from "vitest";
import { escapeExcelText } from "../lib/excel";

describe("Excel export formula safety", () => {
  it("neutralizes formula prefixes", () => {
    expect(["=SUM(A1)", "+cmd", "@name", "-not-a-number"].map(escapeExcelText)).toEqual(["'=SUM(A1)", "'+cmd", "'@name", "'-not-a-number"]);
  });
  it("preserves numeric negative values", () => {
    expect(escapeExcelText("-12.5")).toBe("-12.5");
  });
  it("preserves ordinary and Korean strings", () => {
    expect(escapeExcelText("학생 이름")).toBe("학생 이름");
  });
  it("neutralizes whitespace-prefixed formulas", () => {
    expect([" =SUM(A1)", "\t=SUM(A1)", "\n=SUM(A1)"].map(escapeExcelText)).toEqual(["' =SUM(A1)", "'\t=SUM(A1)", "'\n=SUM(A1)"]);
  });
  it("neutralizes whitespace-prefixed formulas", () => {
    expect([" =SUM(A1)", "\t=SUM(A1)", "\n=SUM(A1)"].map(escapeExcelText)).toEqual(["' =SUM(A1)", "'\t=SUM(A1)", "'\n=SUM(A1)"]);
  });
});
