import { describe, expect, it } from "vitest";
import { displayNameOrFallback, formatAttendanceStatus, formatGlobalRoles, formatPermissionReason } from "../domain/presentation";

describe("user-facing presentation labels", () => {
  it("does not expose global role codes in account labels", () => {
    expect(formatGlobalRoles({ globalRoles: ["system_owner", "teacher"] })).toBe("최고관리자, 교직원");
  });

  it("maps attendance and permission codes to Korean labels", () => {
    expect(formatAttendanceStatus("EXCUSED_ABSENCE")).toBe("인정 결석");
    expect(formatAttendanceStatus("UNEXCUSED_ABSENCE")).toBe("무단 결석");
    expect(formatAttendanceStatus("MISSING")).toBe("미입력");
    expect(formatPermissionReason("ACADEMY")).toBe("학원");
  });

  it("uses a safe display fallback instead of an internal identifier", () => {
    expect(displayNameOrFallback("", "이름 정보 없음")).toBe("이름 정보 없음");
    expect(displayNameOrFallback("김민준", "이름 정보 없음")).toBe("김민준");
  });
});
