import { useState } from "react"
import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// Sends a user who is signed in when they open the page to the home page (US3 scenario 1).
// Nothing is shown while the signed-in state is loading, so the page never flashes up first.
// If the state cannot be read, the page is shown: the server still refuses a signed-in user.
export function SignedOutOnly({ children }: { children: ReactNode }) {
  const status = useCurrentUserStore((state) => state.status)
  // Once the page has been shown, it handles its own navigation: after registering it opens the
  // home page with the success banner, which a redirect from here would replace (US3 scenario 2
  // covers signing in elsewhere while the page is open).
  const [shown, setShown] = useState(false)
  if (!shown && (status === "signedOut" || status === "error")) {
    setShown(true)
  }

  if (shown) {
    return children
  }

  if (status === "signedIn") {
    return <Navigate to="/" replace />
  }

  return null
}
