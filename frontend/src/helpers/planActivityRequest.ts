import type {
  PlanActivitiesCheckRequest,
  PlanActivity,
} from "../types/planActivity"
import { parseDecimal } from "./parseDecimal"

// The check request for the activities as entered. Text that is empty or not a plain decimal is sent
// as null, so the server answers with the field's message; an Indoor activity has no limits.
export function planActivitiesRequest(
  activities: PlanActivity[],
): PlanActivitiesCheckRequest {
  return {
    activities: activities.map((activity) => {
      const limit = (text: string) =>
        activity.type === "Outdoor" ? parseDecimal(text) : null
      return {
        categoryId: activity.categoryId,
        type: activity.type,
        durationHours: parseDecimal(activity.durationText),
        requiresDaylight: activity.requiresDaylight,
        maxWindMs: limit(activity.maxWindText),
        maxRainMmPerHour: limit(activity.maxRainText),
        minTemperatureC: limit(activity.minTemperatureText),
        maxTemperatureC: limit(activity.maxTemperatureText),
      }
    }),
  }
}
