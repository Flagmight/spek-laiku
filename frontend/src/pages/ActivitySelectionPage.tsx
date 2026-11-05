import { Link, Navigate } from "react-router-dom"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupSummary } from "../components/planSetupSummary"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Step 2 of a plan, first version (spec FR-024 to FR-026): only the setup the server accepted and a
// way back. Feature 005 adds the activity selection here. Without a checked setup, for example after
// a change on Plan setup, the user goes back to step 1.
export function ActivitySelectionPage() {
  usePageTitle("Activity selection")
  const checked = usePlanSetupStore((state) => state.checked)

  if (!checked) {
    return <Navigate to="/plan/setup" replace />
  }

  return (
    <>
      <h1>Activity selection</h1>
      <PlanProgress current={2} />
      <PlanSetupSummary setup={checked} />
      <p>
        <Link to="/plan/setup" className="button-link">
          Back
        </Link>
      </p>
    </>
  )
}
