import { describe, expect, it } from "vitest";
import { statisticsClassSelect } from "../domain/scope";

describe("statistics class select", () => {
  const list = [{ id: "c1" }, { id: "c2" }];
  it("locks the class filter to the pinned own class for a homeroom teacher", () => {
    expect(statisticsClassSelect({ canViewGrade: false, classScope: "c1", classes: list })).toEqual({ value: "c1", locked: true, options: [{ id: "c1" }] });
  });
  it("keeps the whole-grade choice and every class for owners and grade admins", () => {
    expect(statisticsClassSelect({ canViewGrade: true, classScope: "", classes: list })).toEqual({ value: "", locked: false, options: list });
    expect(statisticsClassSelect({ canViewGrade: true, classScope: "c2", classes: list })).toEqual({ value: "c2", locked: false, options: list });
  });
  it("shows no option for a locked user without an accessible class", () => {
    expect(statisticsClassSelect({ canViewGrade: false, classScope: null, classes: list })).toEqual({ value: "", locked: true, options: [] });
  });
});
