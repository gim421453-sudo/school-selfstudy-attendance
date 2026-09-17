import { describe, expect, it } from "vitest";
import { dateForMonth } from "../domain/monthDate";
describe("supervision month date initialization",()=>{it("keeps a valid date in the selected month",()=>expect(dateForMonth("2026-09","2026-09-17")).toBe("2026-09-17"));it("initializes another month on day one",()=>expect(dateForMonth("2026-10","2026-09-30")).toBe("2026-10-01"));it("never creates an invalid shorter-month or February date",()=>{expect(dateForMonth("2026-02","2026-01-31")).toBe("2026-02-01");expect(dateForMonth("2026-04","2026-03-31")).toBe("2026-04-01");});});
