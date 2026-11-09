import { Link, Navigate } from "react-router-dom"
import { PlanActivitiesSummary } from "../components/planActivitiesSummary"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupSummary } from "../components/planSetupSummary"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Step 3 of a plan, first version (spec FR-017, FR-018): what the server accepted in steps 1 and 2,
// and a way back. Features 006 and 007 add the forecast and places here.
export function PlacesAndForecastPage() {
  usePageTitle("Places and forecast")
  const setup = usePlanSetupStore((state) => state.checked)
  const activities = usePlanActivitiesStore((state) => state.checked)

  if (!setup) {
    return <Navigate to="/plan/setup" replace />
  }

  if (!activities) {
    return <Navigate to="/plan/activities" replace />
  }

  return (
    <>
      <h1>Places and forecast</h1>
      <PlanProgress current={3} />
      <PlanSetupSummary setup={setup} />
      <PlanActivitiesSummary activities={activities} />
      <p>
        <Link to="/plan/activities" className="button-link">
          Back
        </Link>
      </p>
    </>
  )
}
