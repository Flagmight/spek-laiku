import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { activitySettingsText } from "../helpers/activitySettingsText"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import type { NavigationState } from "../types/navigationState"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { PlanPlaces } from "../types/planPlaces"
import { ActivityForecast } from "./activityForecast"
import { ActivityPlaces } from "./activityPlaces"

interface PlanActivitiesSummaryProps {
  activities: CheckedPlanActivity[]
  // When given, each activity's forecast area follows its settings; the server answers in the same order.
  forecast?: PlanForecast
  // When given, each activity lists the places of its category (feature 007 FR-017).
  places?: PlanPlaces
}

function headingId(activityId: string) {
  return `forecast-activity-${activityId}`
}

// The activities the server accepted, numbered as on step 2 when a category appears more than once. Each
// activity is a section named after it, so its places and forecast area are labelled too (feature 006
// FR-020, feature 007 FR-017). An activity without a place can be removed here or changed on step 2
// (feature 007 FR-020, FR-021).
export function PlanActivitiesSummary({
  activities,
  forecast,
  places,
}: PlanActivitiesSummaryProps) {
  const names = planActivityNames(activities)
  const navigate = useNavigate()
  const [removedMessage, setRemovedMessage] = useState("")
  // The heading a Remove chose to focus once the list without that activity has rendered.
  const focusAfterRemove = useRef<string | null>(null)

  useEffect(() => {
    if (focusAfterRemove.current) {
      document.getElementById(headingId(focusAfterRemove.current))?.focus()
      focusAfterRemove.current = null
    }
  })

  function remove(activity: CheckedPlanActivity) {
    const index = activities.indexOf(activity)
    const neighbour = activities[index + 1] ?? activities[index - 1]
    // The three stores change in the same handler, so React renders them together, and nothing is asked
    // again: the other activities keep their places and forecast (feature 007 FR-020).
    usePlanActivitiesStore.getState().removeChecked(activity.id)
    usePlanForecastStore.getState().removeActivity(activity.id)
    usePlanPlacesStore.getState().removeActivity(activity.id)
    focusAfterRemove.current = neighbour?.id ?? null
    setRemovedMessage(`${names[activity.id]} removed.`)
  }

  function change(activity: CheckedPlanActivity) {
    const state: NavigationState = { focusActivityId: activity.id }
    void navigate("/plan/activities", { state })
  }

  return (
    <>
      <ul aria-label="Plan activities" className="plan-activities-summary">
        {activities.map((activity, index) => {
          const activityForecast = forecast?.activities[index]
          return (
            <li key={activity.id}>
              <section aria-labelledby={headingId(activity.id)}>
                <h2 id={headingId(activity.id)} tabIndex={-1}>
                  {names[activity.id]}
                </h2>
                <ActivityPlaces
                  places={
                    places?.categories.find(
                      (category) => category.categoryId === activity.categoryId,
                    )?.places
                  }
                  radiusKm={places?.radiusKm ?? 0}
                  activityName={names[activity.id]}
                  onRemove={() => remove(activity)}
                  onChange={() => change(activity)}
                />
                <p>{activitySettingsText(activity)}</p>
                {forecast && activityForecast && (
                  <ActivityForecast
                    activity={activity}
                    name={names[activity.id]}
                    forecast={activityForecast}
                    days={forecast.days}
                  />
                )}
              </section>
            </li>
          )
        })}
      </ul>
      {/* Always present, so the message is announced when its text changes, without moving focus. */}
      <p role="status" className="visually-hidden">
        {removedMessage}
      </p>
    </>
  )
}
