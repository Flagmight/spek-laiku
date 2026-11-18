import { Link } from "react-router-dom"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { usePageTitle } from "../hooks/usePageTitle"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

// Shown at the refused address to a signed-in Active user without the needed role (FR-019), and for another
// user's saved plan. An Active Registered User also gets a link to their own plans (feature 010 spec FR-014).
export function AccessDeniedPage() {
  usePageTitle("Access denied")
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  return (
    <>
      <h1>Access denied</h1>
      <p>You do not have permission to open this page.</p>
      <p>
        <Link to="/">Go to the home page</Link>
      </p>
      {canViewSavedPlans(status, user) && (
        <p>
          <Link to="/plans">Go to My plans</Link>
        </p>
      )}
    </>
  )
}
