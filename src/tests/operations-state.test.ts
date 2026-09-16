import { Timestamp } from "firebase/firestore";
import { describe, expect, it } from "vitest";
import { getOperationsPhase, maintenanceNoticeKey } from "../domain/operationsState";
import { DEFAULT_OPERATIONS_SETTINGS } from "../services/operations";

const scheduled = (mode: typeof DEFAULT_OPERATIONS_SETTINGS.emergencyMode = "NORMAL") => ({ ...DEFAULT_OPERATIONS_SETTINGS, emergencyMode: mode, maintenance: { ...DEFAULT_OPERATIONS_SETTINGS.maintenance, enabled: true, title: "점검", message: "안내", noticeFrom: Timestamp.fromDate(new Date("2026-09-20T20:00:00Z")), startsAt: Timestamp.fromDate(new Date("2026-09-20T22:00:00Z")), endsAt: Timestamp.fromDate(new Date("2026-09-20T23:00:00Z")) } });

describe("operations phase", () => {
  it("distinguishes normal, read-only, essential, notice, maintenance, and lockdown", () => {
    expect(getOperationsPhase(DEFAULT_OPERATIONS_SETTINGS)).toBe("normal");
    expect(getOperationsPhase({ ...DEFAULT_OPERATIONS_SETTINGS, emergencyMode: "READ_ONLY" })).toBe("read_only");
    expect(getOperationsPhase({ ...DEFAULT_OPERATIONS_SETTINGS, emergencyMode: "ESSENTIAL_ONLY" })).toBe("essential");
    expect(getOperationsPhase(scheduled(), new Date("2026-09-20T21:00:00Z"))).toBe("notice");
    expect(getOperationsPhase(scheduled(), new Date("2026-09-20T22:30:00Z"))).toBe("maintenance");
    expect(getOperationsPhase({ ...DEFAULT_OPERATIONS_SETTINGS, emergencyMode: "LOCKDOWN" })).toBe("lockdown");
  });
  it("releases scheduled maintenance and retains explicit emergency modes", () => {
    expect(getOperationsPhase(scheduled(), new Date("2026-09-20T23:01:00Z"))).toBe("normal");
    expect(getOperationsPhase(scheduled("READ_ONLY"), new Date("2026-09-20T23:01:00Z"))).toBe("read_only");
    expect(getOperationsPhase(scheduled("MAINTENANCE"), new Date("2026-09-20T19:00:00Z"))).toBe("maintenance");
  });
  it("changes the popup key for a new notice", () => {
    expect(maintenanceNoticeKey(scheduled())).not.toBe(maintenanceNoticeKey({ ...scheduled(), maintenance: { ...scheduled().maintenance, title: "새 점검" } }));
    expect(maintenanceNoticeKey(scheduled())).not.toBe(maintenanceNoticeKey({ ...scheduled(), maintenance: { ...scheduled().maintenance, startsAt: Timestamp.fromDate(new Date("2026-09-21T22:00:00Z")) } }));
  });
});
