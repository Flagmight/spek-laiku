import { describe, expect, it } from "vitest"
import { activitySettingsText } from "../helpers/activitySettingsText"
import type { CheckedPlanActivity } from "../types/planActivity"

const kayaking: CheckedPlanActivity = {
  id: "a",
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
  id: "b",
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

describe("activitySettingsText", () => {
  it("puts an Outdoor activity's settings and limits on one line", () => {
    expect(activitySettingsText(kayaking)).toBe(
      "Outdoor · 2 h · Requires daylight · Wind up to 8 m/s · Rain up to 0.5 mm/h · 15 to 35 °C",
    )
  })

  it("has no weather limits for an Indoor activity without daylight", () => {
    expect(activitySettingsText(museum)).toBe(
      "Indoor · 1.5 h · No daylight needed",
    )
  })

  it("says when an Indoor activity requires daylight", () => {
    expect(activitySettingsText({ ...museum, requiresDaylight: true })).toBe(
      "Indoor · 1.5 h · Requires daylight",
    )
  })
})
