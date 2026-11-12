import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import { answerForecast } from "./forecastFixtures"
import { planPlaces } from "./placesFixtures"
import { jsonResponse } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

// Step 3 as the accessibility, keyboard and phone tests use it: a checked setup in Kaunas for Saturday 7
// November and checked Kayaking and Museum, where Kayaking has two places and Museum none within 30 km.

const kayaking: CheckedPlanActivity = {
  id: "activity-kayaking",
  categoryId: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  durationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 15,
  maxTemperatureC: 35,
}

const museum: CheckedPlanActivity = {
  id: "activity-museum",
  categoryId: "category-museum",
  name: "Museum",
  type: "Indoor",
  durationHours: 1.5,
  requiresDaylight: true,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

export function acceptKayakingAndMuseum() {
  usePlanSetupStore.getState().setChecked({
    location: {
      id: 598316,
      name: "Kaunas",
      area: "Kaunas County",
      latitude: 54.90156,
      longitude: 23.90909,
    },
    dates: ["2026-11-07"],
    maxTravelDistanceKm: 30,
  })
  const activities = usePlanActivitiesStore.getState()
  activities.setChecked([kayaking, museum])
  usePlanActivitiesStore.setState({
    activities: [kayaking, museum].map((activity) => ({
      id: activity.id,
      categoryId: activity.categoryId,
      name: activity.name,
      type: activity.type,
      durationText: String(activity.durationHours),
      requiresDaylight: activity.requiresDaylight,
      maxWindText:
        activity.maxWindMs === null ? "" : String(activity.maxWindMs),
      maxRainText:
        activity.maxRainMmPerHour === null
          ? ""
          : String(activity.maxRainMmPerHour),
      minTemperatureText:
        activity.minTemperatureC === null
          ? ""
          : String(activity.minTemperatureC),
      maxTemperatureText:
        activity.maxTemperatureC === null
          ? ""
          : String(activity.maxTemperatureC),
    })),
  })
}

type Handler = (request: RecordedRequest) => Response | Promise<Response>

// The routes of step 3 for a visitor: the forecast for the checked dates, and the places above unless the
// test answers them itself.
export function placesStepRoutes(
  places: Handler = () =>
    jsonResponse(
      200,
      planPlaces(
        ["category-kayaking", "category-museum"],
        {},
        {
          "category-museum": [],
        },
      ),
    ),
): Record<string, Handler> {
  return {
    "GET /api/auth/me": () => jsonResponse(401),
    "POST /api/plan-forecast": answerForecast,
    "POST /api/plan-places": places,
  }
}
