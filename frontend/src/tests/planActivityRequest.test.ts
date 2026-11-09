import { describe, expect, it } from "vitest"
import { planActivitiesRequest } from "../helpers/planActivityRequest"
import type { PlanActivity } from "../types/planActivity"

const outdoor: PlanActivity = {
  id: "a",
  categoryId: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  durationText: "2.5",
  requiresDaylight: true,
  maxWindText: "8",
  maxRainText: "0.5",
  minTemperatureText: "-5",
  maxTemperatureText: "35",
}

describe("planActivitiesRequest", () => {
  it("sends an Outdoor activity's numbers and leaves out its browser id and name", () => {
    expect(planActivitiesRequest([outdoor])).toEqual({
      activities: [
        {
          categoryId: "category-cycling",
          type: "Outdoor",
          durationHours: 2.5,
          requiresDaylight: true,
          maxWindMs: 8,
          maxRainMmPerHour: 0.5,
          minTemperatureC: -5,
          maxTemperatureC: 35,
        },
      ],
    })
  })

  it.each(["", "  ", "2,5", "abc"])("sends %j as null", (text) => {
    const [activity] = planActivitiesRequest([
      { ...outdoor, durationText: text, maxWindText: text },
    ]).activities

    expect(activity.durationHours).toBeNull()
    expect(activity.maxWindMs).toBeNull()
  })

  it("sends null limits for an Indoor activity, whatever the text says", () => {
    const [activity] = planActivitiesRequest([
      { ...outdoor, type: "Indoor", requiresDaylight: false },
    ]).activities

    expect(activity).toMatchObject({
      type: "Indoor",
      durationHours: 2.5,
      requiresDaylight: false,
      maxWindMs: null,
      maxRainMmPerHour: null,
      minTemperatureC: null,
      maxTemperatureC: null,
    })
  })
})
