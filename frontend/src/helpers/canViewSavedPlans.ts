import type { CurrentUserState } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"

// Who has saved plans: a signed-in, Active Registered User (feature 010 spec FR-012, FR-014). Used by the
// Save plan section, the navigation, Home, Access denied and the saved plan pages' guard. The server checks
// the same rule on every request (ActiveRegisteredUser policy); this only decides what to show.
export function canViewSavedPlans(
  status: CurrentUserState["status"],
  user: CurrentUser | null,
): boolean {
  return (
    status === "signedIn" &&
    user?.role === "Registered User" &&
    user.accountStatus === "Active"
  )
}
