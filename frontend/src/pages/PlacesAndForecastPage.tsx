import { useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { PlacesAndForecastStatus } from "../components/placesAndForecastStatus"
import { PlanActivitiesSummary } from "../components/planActivitiesSummary"
import { PlanOverview } from "../components/planOverview"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupSummary } from "../components/planSetupSummary"
import { isFirstLoad } from "../helpers/isFirstLoad"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Step 3 of a plan (feature 005 FR-017 and FR-018, feature 006 FR-003 and FR-020, feature 007 FR-003 and
// FR-014): what the server accepted in steps 1 and 2, the places and the forecast for each activity, and a
// way back. Both are asked for together each time the page opens and dropped when it closes (feature 006
// FR-025, feature 007 FR-023). Until both have answered, only the loading message is shown.
export function PlacesAndForecastPage() {
  usePageTitle("Places and forecast")
  const setup = usePlanSetupStore((state) => state.checked)
  const activities = usePlanActivitiesStore((state) => state.checked)
  const forecastStatus = usePlanForecastStore((state) => state.status)
  const forecast = usePlanForecastStore((state) =>
    state.status === "loaded" ? state.forecast : null,
  )
  const placesStatus = usePlanPlacesStore((state) => state.status)
  const places = usePlanPlacesStore((state) =>
    state.status === "loaded" ? state.places : null,
  )
  const hasSetup = setup !== null
  const hasActivities = activities !== null

  // Only whether a checked plan exists starts the requests, so a change to the checked activities on this
  // step (removing one) asks for nothing new (feature 007 research section 10).
  useEffect(() => {
    if (!hasSetup || !hasActivities) {
      return
    }

    const checkedSetup = usePlanSetupStore.getState().checked!
    const checkedActivities = usePlanActivitiesStore.getState().checked!
    const forecastStore = usePlanForecastStore.getState()
    const placesStore = usePlanPlacesStore.getState()
    void forecastStore.load(checkedSetup, checkedActivities)
    void placesStore.load(checkedSetup, checkedActivities)
    return () => {
      forecastStore.reset()
      placesStore.reset()
    }
  }, [hasSetup, hasActivities])

  if (!setup) {
    return <Navigate to="/plan/setup" replace />
  }

  if (!activities) {
    return <Navigate to="/plan/activities" replace />
  }

  const firstLoad = isFirstLoad(forecastStatus) || isFirstLoad(placesStatus)

  return (
    <>
      <h1>Places and forecast</h1>
      <PlanProgress current={3} />
      <PlanSetupSummary setup={setup} />
      <PlacesAndForecastStatus />
      {!firstLoad && (
        <>
          <PlanOverview
            activities={activities}
            names={planActivityNames(activities)}
            forecast={forecast ?? undefined}
            places={places ?? undefined}
          />
          <PlanActivitiesSummary
            activities={activities}
            forecast={forecast ?? undefined}
            places={places ?? undefined}
          />
        </>
      )}
      <p>
        <Link to="/plan/activities" className="button-link">
          Back
        </Link>
      </p>
    </>
  )
}
