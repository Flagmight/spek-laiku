import { planActivityNames } from "../helpers/planActivityNames"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import { ActivityForecast } from "./activityForecast"

interface PlanActivitiesSummaryProps {
  activities: CheckedPlanActivity[]
  // When given, each activity's forecast area follows its settings; the server answers in the same order.
  forecast?: PlanForecast
}

// The activities the server accepted, numbered as on step 2 when a category appears more than once. Each
// activity is a section named after it, so its forecast area is labelled too (spec FR-020).
export function PlanActivitiesSummary({
  activities,
  forecast,
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
