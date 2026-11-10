import { useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { PlanActivitiesSummary } from "../components/planActivitiesSummary"
import { PlanForecastStatus } from "../components/planForecastStatus"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupSummary } from "../components/planSetupSummary"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Step 3 of a plan (feature 005 FR-017 and FR-018, feature 006 FR-003 and FR-020): what the server accepted
// in steps 1 and 2, the forecast for each activity, and a way back. The forecast is asked for each time the
// page opens and dropped when it closes (feature 006 FR-025). Feature 007 adds the places here.
export function PlacesAndForecastPage() {
  usePageTitle("Places and forecast")
  const setup = usePlanSetupStore((state) => state.checked)
  const activities = usePlanActivitiesStore((state) => state.checked)
  const forecast = usePlanForecastStore((state) =>
    state.status === "loaded" ? state.forecast : null,
  )

  useEffect(() => {
    if (!setup || !activities) {
      return
    }

    const forecastStore = usePlanForecastStore.getState()
    void forecastStore.load(setup, activities)
    return () => forecastStore.reset()
  }, [setup, activities])

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
      <PlanForecastStatus />
      <PlanActivitiesSummary
        activities={activities}
        forecast={forecast ?? undefined}
      />
      <p>
        <Link to="/plan/activities" className="button-link">
          Back
        </Link>
      </p>
    </>
  )
}
