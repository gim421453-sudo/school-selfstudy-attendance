import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPERATIONS_SETTINGS, validateOperationsSettings } from "../services/operations";

describe("operations settings contract", () => {
  it("defaults to normal operation", () => {
    expect(DEFAULT_OPERATIONS_SETTINGS.emergencyMode).toBe("NORMAL");
    expect(validateOperationsSettings(DEFAULT_OPERATIONS_SETTINGS)).toBeNull();
  });

  it("accepts an ordered scheduled maintenance window", () => {
    const notice = Timestamp.fromMillis(1_000);
    const starts = Timestamp.fromMillis(2_000);
    const ends = Timestamp.fromMillis(3_000);
    expect(validateOperationsSettings({
      ...DEFAULT_OPERATIONS_SETTINGS,
      emergencyMode: "READ_ONLY",
      maintenance: { ...DEFAULT_OPERATIONS_SETTINGS.maintenance, enabled: true, noticeFrom: notice, startsAt: starts, endsAt: ends },
    })).toBeNull();
  });

  it("rejects unknown modes and invalid maintenance time ordering", () => {
    expect(validateOperationsSettings({ ...DEFAULT_OPERATIONS_SETTINGS, emergencyMode: "BROKEN" as never })).not.toBeNull();
    expect(validateOperationsSettings({
      ...DEFAULT_OPERATIONS_SETTINGS,
      maintenance: { ...DEFAULT_OPERATIONS_SETTINGS.maintenance, enabled: true, noticeFrom: Timestamp.fromMillis(3_000), startsAt: Timestamp.fromMillis(2_000), endsAt: Timestamp.fromMillis(4_000) },
    })).not.toBeNull();
  });
});
