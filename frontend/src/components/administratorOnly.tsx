import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { AccessDeniedPage } from "../pages/AccessDeniedPage"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// Used inside SignedInOnly, so the user is signed in. A Suspended user goes to the Account
// suspended page, a user without the Administrator role sees Access denied at the same address,
// and only an Active Administrator sees the page (FR-018, FR-019). The server checks the same
// rule on every request; this guard only decides what to show.
export function AdministratorOnly({ children }: { children: ReactNode }) {
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  if (status === "loading" || !user) {
    return null
  }

  if (user.accountStatus === "Suspended") {
    return <Navigate to="/account-suspended" replace />
  }

  if (user.role !== "Administrator") {
    return <AccessDeniedPage />
  }

  return children
}
