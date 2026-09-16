import { describe, expect, it } from "vitest";
import { periodAuditChange, validatePeriod } from "../services/masterData";
import type { Period } from "../types/domain";

const existing: Period = { id: "period-1", name: "\uC790\uC728 1\uAD50\uC2DC", order: 1, startTime: "18:00", endTime: "18:50", active: true };

describe("period editing", () => {
  it("keeps the existing ID and creates a PERIOD_UPDATED audit payload", () => {
    const next = { ...existing, name: "\uC790\uC728 \uCCAB \uBC88\uC9F8 \uAD50\uC2DC", endTime: "19:00" };
    validatePeriod(next, [existing]);
    expect(next.id).toBe(existing.id);
    expect(periodAuditChange(next, existing)).toEqual({
      action: "PERIOD_UPDATED",
      before: { name: "\uC790\uC728 1\uAD50\uC2DC", order: 1, startTime: "18:00", endTime: "18:50", active: true },
      after: { name: "\uC790\uC728 \uCCAB \uBC88\uC9F8 \uAD50\uC2DC", order: 1, startTime: "18:00", endTime: "19:00", active: true },
    });
  });

  it("rejects invalid time order and duplicate sequence", () => {
    expect(() => validatePeriod({ ...existing, startTime: "19:00", endTime: "18:00" }, [existing])).toThrow();
    expect(() => validatePeriod({ ...existing, id: "period-2", order: 1 }, [existing])).toThrow();
  });

  it("allows deactivation without deleting the period", () => {
    const inactive = { ...existing, active: false };
    validatePeriod(inactive, [existing]);
    expect(periodAuditChange(inactive, existing).after).toMatchObject({ active: false });
  });
});
