import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { AccessDeniedPage } from "../pages/AccessDeniedPage"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// The saved plan pages are for signed-in, Active Registered Users (feature 010 spec FR-012). Used inside
// SignedInOnly, which already sends Visitors to Log in. A Suspended user goes to the Account suspended page;
// an Administrator sees Access denied at the same address. The server checks the same rule on every request
// (ActiveRegisteredUser policy); this guard only decides what to show.
export function RegisteredUserOnly({ children }: { children: ReactNode }) {
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  if (status === "loading") {
    return null
  }

  if (status === "signedIn" && user?.accountStatus === "Suspended") {
    return <Navigate to="/account-suspended" replace />
  }

  if (!canViewSavedPlans(status, user)) {
    return <AccessDeniedPage />
  }

  return children
}
