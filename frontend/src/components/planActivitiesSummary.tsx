import { planActivityNames } from "../helpers/planActivityNames"
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

// The activities the server accepted, numbered as on step 2 when a category appears more than once. Each
// activity is a section named after it, so its places and forecast area are labelled too (feature 006
// FR-020, feature 007 FR-017).
export function PlanActivitiesSummary({
  activities,
  forecast,
  places,
}: PlanActivitiesSummaryProps) {
  const names = planActivityNames(activities)

  return (
    <ul aria-label="Plan activities" className="plan-activities-summary">
      {activities.map((activity, index) => {
        const headingId = `forecast-activity-${activity.id}`
        const activityForecast = forecast?.activities[index]
        return (
          <li key={activity.id}>
            <section aria-labelledby={headingId}>
              <h2 id={headingId}>{names[activity.id]}</h2>
              <ActivityPlaces
                places={
                  places?.categories.find(
                    (category) => category.categoryId === activity.categoryId,
                  )?.places
                }
              />
              <p>
                {`${activity.type} · ${activity.durationHours} h · ${
                  activity.requiresDaylight
                    ? "Requires daylight"
                    : "No daylight needed"
                }`}
              </p>
              {activity.type === "Outdoor" && (
                <p>
                  {`Wind up to ${activity.maxWindMs} m/s · Rain up to ${activity.maxRainMmPerHour} mm/h · ${activity.minTemperatureC} to ${activity.maxTemperatureC} °C`}
                </p>
              )}
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
  )
}
