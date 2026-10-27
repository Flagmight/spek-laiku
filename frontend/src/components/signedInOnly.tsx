import { useEffect } from "react"
import type { ReactNode } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { NavigationState } from "../types/navigationState"

// Sends anyone who is not signed in to the Log in page, which returns them here afterwards
// (FR-012, FR-020). The signed-in state is read again on opening, so a session that expired
// while the app was open is noticed and the Log in page says so. No route uses it yet; later
// features (for example 010) wrap their pages in it.
export function SignedInOnly({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation()
  const status = useCurrentUserStore((state) => state.status)
  const sessionExpired = useCurrentUserStore((state) => state.sessionExpired)

  useEffect(() => {
    void useCurrentUserStore.getState().refresh()
  }, [])

  if (status === "loading") {
    return null
  }

  if (status === "signedIn") {
    return children
  }

  const state: NavigationState = {
    loginReason: sessionExpired ? "expired" : "required",
  }
  return (
    <Navigate
      to={"/login?returnTo=" + encodeURIComponent(pathname + search)}
      replace
      state={state}
    />
  )
}
