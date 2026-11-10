import { describe, expect, it } from "vitest"
import { forecastSummaryText } from "../helpers/forecastSummaryText"
import type { ActivityForecast } from "../types/planForecast"

function forecast(changes: Partial<ActivityForecast>): ActivityForecast {
  return {
    weatherIndependent: false,
    suitableHours: 9,
    datesWithSuitableHours: 2,
    hasLongEnoughPeriod: true,
    days: [],
    ...changes,
  }
}

describe("forecastSummaryText", () => {
  it("counts the suitable hours and the dates that have them", () => {
    expect(forecastSummaryText(forecast({}), 3, 2)).toBe(
      "Suitable hours: 9 on 2 of 3 dates.",
    )
  })

  it("says 'date' for a plan with one date", () => {
    expect(
      forecastSummaryText(
        forecast({ suitableHours: 3, datesWithSuitableHours: 1 }),
        1,
        2,
      ),
    ).toBe("Suitable hours: 3 on 1 of 1 date.")
  })

  it("adds that no period is long enough when the server says so", () => {
    expect(
      forecastSummaryText(
        forecast({ suitableHours: 3, hasLongEnoughPeriod: false }),
        3,
        2,
      ),
    ).toBe(
      "Suitable hours: 3 on 2 of 3 dates. No period is long enough for this activity's 2 h.",
    )
  })

  it("suggests other dates or limits when there is no suitable hour", () => {
    expect(
      forecastSummaryText(
        forecast({
          suitableHours: 0,
          datesWithSuitableHours: 0,
          hasLongEnoughPeriod: false,
        }),
        3,
        2,
      ),
    ).toBe(
      "No suitable hours on any of your dates. Try other dates or change this activity's limits.",
    )
  })
})
