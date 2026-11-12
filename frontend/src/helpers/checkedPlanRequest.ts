import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecastRequest } from "../types/planForecast"
import type { CheckedPlanSetup } from "../types/planSetup"

// The forecast request for the setup and activities the server last accepted. The server checks them again
// and looks the location up by its id, so only the id is sent (contracts/plan-forecast-api.md).
export function planForecastRequest(
  setup: CheckedPlanSetup,
  activities: CheckedPlanActivity[],
): PlanForecastRequest {
  return {
    setup: {
      locationId: setup.location.id,
      dates: setup.dates,
      maxTravelDistanceKm: setup.maxTravelDistanceKm,
    },
    activities: activities.map((activity) => ({
      categoryId: activity.categoryId,
      type: activity.type,
      durationHours: activity.durationHours,
      requiresDaylight: activity.requiresDaylight,
      maxWindMs: activity.maxWindMs,
      maxRainMmPerHour: activity.maxRainMmPerHour,
      minTemperatureC: activity.minTemperatureC,
      maxTemperatureC: activity.maxTemperatureC,
    })),
  }
}
