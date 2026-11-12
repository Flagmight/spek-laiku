import { describe, expect, it } from "vitest"
import { planForecastRequest } from "../helpers/planForecastRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"

const setup: CheckedPlanSetup = {
  location: {
    id: 593116,
    name: "Vilnius",
    area: "Vilnius County",
    latitude: 54.6872,
    longitude: 25.2797,
  },
  dates: ["2026-11-14", "2026-11-15"],
  maxTravelDistanceKm: 40,
}

const kayaking: CheckedPlanActivity = {
  id: "browser-id-1",
  categoryId: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  durationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
}

const museum: CheckedPlanActivity = {
  id: "browser-id-2",
  categoryId: "category-museum",
  name: "Museum",
  type: "Indoor",
  durationHours: 1.5,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

describe("planForecastRequest", () => {
  it("sends the checked setup with only the location's id", () => {
    expect(planForecastRequest(setup, []).setup).toEqual({
      locationId: 593116,
      dates: ["2026-11-14", "2026-11-15"],
      maxTravelDistanceKm: 40,
    })
  })

  it("sends each checked activity in order without the browser's id or name", () => {
    expect(planForecastRequest(setup, [kayaking, museum]).activities).toEqual([
      {
        categoryId: "category-kayaking",
        type: "Outdoor",
        durationHours: 2.5,
        requiresDaylight: true,
        maxWindMs: 8,
        maxRainMmPerHour: 0.5,
        minTemperatureC: 18,
        maxTemperatureC: 35,
      },
      {
        categoryId: "category-museum",
        type: "Indoor",
        durationHours: 1.5,
        requiresDaylight: false,
        maxWindMs: null,
        maxRainMmPerHour: null,
        minTemperatureC: null,
        maxTemperatureC: null,
      },
    ])
  })
})
