import { describe, expect, it } from "vitest";
import { canEnterApplication, isApprovedAppUser } from "../auth/authorization";
import type { AppUser } from "../types/domain";

const approvedUser: AppUser = {
  uid: "approved-uid",
  email: "staff@example.com",
  displayName: "Staff",
  roles: ["teacher"],
  active: true,
};

describe("application authorization", () => {
  it("allows an active users document matching the authenticated UID", () => {
    expect(canEnterApplication({ uid: "approved-uid" }, approvedUser)).toBe(true);
  });

  it("denies an authenticated Google identity with no users document", () => {
    expect(canEnterApplication({ uid: "google-only-uid" }, null)).toBe(false);
  });

  it("denies an inactive users document", () => {
    expect(canEnterApplication({ uid: "approved-uid" }, { ...approvedUser, active: false })).toBe(false);
  });

  it("does not grant roles from Google authentication alone", () => {
    expect(isApprovedAppUser(null)).toBe(false);
    expect(canEnterApplication({ uid: "google-owner-looking-uid" }, { ...approvedUser, uid: "google-owner-looking-uid", roles: [] })).toBe(true);
  });
});
