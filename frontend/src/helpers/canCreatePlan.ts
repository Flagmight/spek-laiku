import type { CurrentUserState } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"

// Who may set up a plan: a Visitor, or a signed-in Active Registered User (spec FR-001, FR-002).
// Used by the navigation, the home page and the plan pages' guard. The server checks the same rule
// on every request (PlanCreator policy); this only decides what to show.
export function canCreatePlan(
  status: CurrentUserState["status"],
  user: CurrentUser | null,
): boolean {
  // "error" means the signed-in state could not be read; the navigation treats that as a visitor too.
  if (status === "signedOut" || status === "error") {
    return true
  }

  return (
    status === "signedIn" &&
    user?.role === "Registered User" &&
    user.accountStatus === "Active"
  )
}
