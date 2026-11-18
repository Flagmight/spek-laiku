import { Link } from "react-router-dom"
import { SavedPlansBlock } from "../components/savedPlansBlock"
import { canCreatePlan } from "../helpers/canCreatePlan"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { usePageTitle } from "../hooks/usePageTitle"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"

export function HomePage() {
  usePageTitle("Home")
  const status = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)

  return (
    <>
      <h1>Spėk laiku</h1>
      {/* The same rule as the navigation item (spec FR-001, FR-002). */}
      {canCreatePlan(status, user) && (
        <p>
          <Link to="/plan/setup" className="button-link">
            Create plan
          </Link>
        </p>
      )}
      {/* Only Active Registered Users have saved plans (feature 010 spec FR-011). */}
      {canViewSavedPlans(status, user) && <SavedPlansBlock />}
    </>
  )
}
