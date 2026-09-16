import type { OperationsSettings } from "../types/domain";

function date(value: unknown): Date | null { return value && typeof value === "object" && "toDate" in value ? (value as { toDate(): Date }).toDate() : null; }
export type OperationsPhase = "normal" | "read_only" | "essential" | "notice" | "maintenance" | "lockdown";
export function getOperationsPhase(settings: OperationsSettings | null, now = new Date()): OperationsPhase {
  if (!settings) return "normal";
  if (settings.emergencyMode === "LOCKDOWN") return "lockdown";
  if (settings.emergencyMode === "MAINTENANCE") return "maintenance";
  const start = date(settings.maintenance.startsAt); const end = date(settings.maintenance.endsAt); const notice = date(settings.maintenance.noticeFrom);
  if (settings.maintenance.enabled && start && end && now >= start && now < end) return "maintenance";
  if (settings.maintenance.enabled && notice && start && now >= notice && now < start) return "notice";
  return settings.emergencyMode === "READ_ONLY" ? "read_only" : settings.emergencyMode === "ESSENTIAL_ONLY" ? "essential" : "normal";
}
export function maintenanceNoticeKey(settings: OperationsSettings) {
  const start = date(settings.maintenance.startsAt);
  return `${settings.maintenance.title}:${start?.toISOString() ?? ""}`;
}
