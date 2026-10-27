import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// Shows the page only to a signed-in Suspended user (FR-021); everyone else opens the home page.
// Nothing is shown while the signed-in state is loading.
export function SuspendedOnly({ children }: { children: ReactNode }) {
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  if (status === "loading") {
    return null
  }

  if (status === "signedIn" && user?.accountStatus === "Suspended") {
    return children
  }

  return <Navigate to="/" replace />
}
