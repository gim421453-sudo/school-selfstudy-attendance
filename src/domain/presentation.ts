import type { AppUser, SelfStudyAttendanceStatus } from "../types/domain";

const globalRoleLabels: Record<string, string> = {
  system_owner: "최고관리자",
  teacher: "교직원",
};

const attendanceLabels: Record<SelfStudyAttendanceStatus | "MISSING", string> = {
  PRESENT: "출석",
  EXCUSED_ABSENCE: "인정 결석",
  UNEXCUSED_ABSENCE: "무단 결석",
  MISSING: "미입력",
};

const permissionReasonLabels: Record<string, string> = {
  ACADEMY: "학원",
  MEDICAL: "병원/의료",
  FAMILY: "가정사",
  SCHOOL_ACTIVITY: "학교활동",
  OTHER: "기타",
};

export function formatGlobalRoles(user: Pick<AppUser, "globalRoles">): string {
  const labels = (user.globalRoles ?? ["teacher"]).map((role) => globalRoleLabels[role] ?? "교직원");
  return [...new Set(labels)].join(", ");
}

export function formatAttendanceStatus(status: SelfStudyAttendanceStatus | "MISSING"): string {
  return attendanceLabels[status];
}

export function formatPermissionReason(code: string | undefined): string {
  return code ? permissionReasonLabels[code] ?? "기타" : "";
}

export function displayNameOrFallback(name: string | null | undefined, fallback: string): string {
  return name?.trim() || fallback;
}

export function safeLoadError(context: string, error: unknown, fallback = "정보를 불러오지 못했습니다. 다시 시도해 주세요."): string {
  console.error(`[${context}]`, error);
  return fallback;
}
