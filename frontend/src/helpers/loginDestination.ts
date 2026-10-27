import type { CurrentUser } from "../types/currentUser"
import { safeReturnTo } from "./safeReturnTo"

// The page to open after a successful login (FR-010, FR-011, FR-012).
// A Suspended user always lands on the Account Suspended page. Everyone else returns to the
// page they asked for, or opens the home page. Feature 015 changes the Administrator default
// to the Service status page.
export function loginDestination(
  user: CurrentUser,
  returnTo: string | null,
): string {
  if (user.accountStatus === "Suspended") {
    return "/account-suspended"
  }

  return safeReturnTo(returnTo) ?? "/"
}
