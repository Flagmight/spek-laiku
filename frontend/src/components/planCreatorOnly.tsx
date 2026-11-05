import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { canCreatePlan } from "../helpers/canCreatePlan"
import { AccessDeniedPage } from "../pages/AccessDeniedPage"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// The plan pages are for Visitors and Active Registered Users (spec FR-001, FR-002). Signing in is not
// required. A Suspended user goes to the Account suspended page; an Administrator, who must not create
// plans for users, sees Access denied at the same address. The server checks the same rule on every
// request (PlanCreator policy); this guard only decides what to show. Nothing is shown while the
// signed-in state loads, so no plan request is sent for someone who may not set up a plan.
export function PlanCreatorOnly({ children }: { children: ReactNode }) {
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  if (status === "loading") {
    return null
  }

  if (status === "signedIn" && user?.accountStatus === "Suspended") {
    return <Navigate to="/account-suspended" replace />
  }

  // The same rule as Create plan in the navigation and on Home, so they cannot drift apart.
  if (!canCreatePlan(status, user)) {
    return <AccessDeniedPage />
  }

  return children
}
