import type { CheckedPlanActivity } from "../types/planActivity"

// An activity's settings on one line (feature 007 FR-017), for example "Outdoor · 2 h · Requires daylight ·
// Wind up to 8 m/s · Rain up to 0.5 mm/h · 15 to 35 °C". Indoor activities have no weather limits.
export function activitySettingsText(activity: CheckedPlanActivity): string {
  const parts = [
    activity.type,
    `${activity.durationHours} h`,
    activity.requiresDaylight ? "Requires daylight" : "No daylight needed",
  ]
  if (activity.type === "Outdoor") {
    parts.push(
      `Wind up to ${activity.maxWindMs} m/s`,
      `Rain up to ${activity.maxRainMmPerHour} mm/h`,
      `${activity.minTemperatureC} to ${activity.maxTemperatureC} °C`,
    )
  }

  return parts.join(" · ")
}
