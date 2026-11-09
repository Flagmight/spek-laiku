import { describe, expect, it } from "vitest"
import {
  activityFieldId,
  planActivitySummaryErrors,
} from "../helpers/planActivityFieldIds"
import type { PlanActivity } from "../types/planActivity"

function activity(id: string): PlanActivity {
  return {
    id,
    categoryId: `category-${id}`,
    name: id,
    type: "Outdoor",
    durationText: "2",
    requiresDaylight: true,
    maxWindText: "8",
    maxRainText: "0.5",
    minTemperatureText: "15",
    maxTemperatureText: "35",
  }
}

const names = { a: "Cycling 2", b: "Museum" }

describe("activityFieldId", () => {
  it("gives the input's id for a field and the group's id for the activity", () => {
    expect(activityFieldId("a", "durationHours")).toBe(
      "activity-a-durationHours",
    )
    expect(activityFieldId("a", "activity")).toBe("activity-a")
  })
})

describe("planActivitySummaryErrors", () => {
  it("has nothing for no errors", () => {
    expect(
      planActivitySummaryErrors({ byActivity: {} }, [activity("a")], names),
    ).toEqual([])
  })

  it("lists the messages in page order, each named after its activity", () => {
    const errors = {
      list: "You can add up to 10 activities.",
      byActivity: {
        b: { durationHours: "Duration b." },
        a: {
          maxTemperatureC: "Max a.",
          minTemperatureC: "Min a.",
          maxRainMmPerHour: "Rain a.",
          maxWindMs: "Wind a.",
          durationHours: "Duration a.",
          activity: "Gone a.",
        },
      },
    }

    expect(
      planActivitySummaryErrors(errors, [activity("a"), activity("b")], names),
    ).toEqual([
      {
        fieldId: "plan-activities-heading",
        message: "You can add up to 10 activities.",
      },
      { fieldId: "activity-a", message: "Cycling 2: Gone a." },
      {
        fieldId: "activity-a-durationHours",
        message: "Cycling 2: Duration a.",
      },
      { fieldId: "activity-a-maxWindMs", message: "Cycling 2: Wind a." },
      { fieldId: "activity-a-maxRainMmPerHour", message: "Cycling 2: Rain a." },
      { fieldId: "activity-a-minTemperatureC", message: "Cycling 2: Min a." },
      { fieldId: "activity-a-maxTemperatureC", message: "Cycling 2: Max a." },
      { fieldId: "activity-b-durationHours", message: "Museum: Duration b." },
    ])
  })

  it("leaves out an activity that is no longer in the plan", () => {
    const errors = { byActivity: { a: { durationHours: "Duration a." } } }

    expect(planActivitySummaryErrors(errors, [activity("b")], names)).toEqual(
      [],
    )
  })
})
