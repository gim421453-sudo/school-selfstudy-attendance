import type { AppUser } from "../types/domain";

export interface AuthenticatedIdentity {
  uid: string;
}

export function isApprovedAppUser(appUser: AppUser | null): appUser is AppUser {
  return appUser?.active === true;
}

export function canEnterApplication(identity: AuthenticatedIdentity | null, appUser: AppUser | null): boolean {
  return identity?.uid === appUser?.uid && isApprovedAppUser(appUser);
}

export function googleSignInErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : "";
  if (code === "auth/unauthorized-domain") {
    return "\uD604\uC7AC \uC811\uC18D \uC8FC\uC18C\uAC00 Firebase Authorized domains\uC5D0 \uB4F1\uB85D\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
  }
  const detail = error instanceof Error ? error.message : String(error);
  return `Google \uB85C\uADF8\uC778\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. ${detail}`;
}
