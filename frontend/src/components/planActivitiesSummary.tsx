import { planActivityNames } from "../helpers/planActivityNames"
import type { CheckedPlanActivity } from "../types/planActivity"

// The activities the server accepted, numbered as on step 2 when a category appears more than once.
export function PlanActivitiesSummary({
  activities,
}: {
  activities: CheckedPlanActivity[]
}) {
  const names = planActivityNames(activities)

  return (
    <ul aria-label="Plan activities" className="plan-activities-summary">
      {activities.map((activity) => (
        <li key={activity.id}>
          <p>
            <strong>{names[activity.id]}</strong>
          </p>
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
        </li>
      ))}
    </ul>
  )
}
