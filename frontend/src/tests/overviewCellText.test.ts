import { describe, expect, it } from "vitest"
import {
  dateCellText,
  missingCellText,
  placeCellText,
} from "../helpers/overviewCellText"
import type { ActivityDayForecast, SuitablePeriod } from "../types/planForecast"
import { forecastDay } from "./forecastFixtures"
import { lampedziai, nemunoSlipway } from "./placesFixtures"

function activityDay(
  longestPeriod: SuitablePeriod | null,
): ActivityDayForecast {
  return {
    date: "2026-11-14",
    periods: longestPeriod ? [longestPeriod] : [],
    longestPeriod,
    hours: [],
  }
}

describe("dateCellText", () => {
  const day = forecastDay("2026-11-14")

  it("words the server's longest period", () => {
    expect(
      dateCellText(
        day,
        activityDay({
          start: "10:00",
          end: "14:00",
          lengthHours: 4,
          shorterThanDuration: false,
        }),
      ),
    ).toBe("★ 10:00–14:00 (4 h)")
  })

  it("adds 'too short' when the server marked the period shorter than the activity", () => {
    expect(
      dateCellText(
        day,
        activityDay({
          start: "10:00",
          end: "11:00",
          lengthHours: 1,
          shorterThanDuration: true,
        }),
      ),
    ).toBe("★ 10:00–11:00 (1 h), too short")
  })

  it("says None when the date has hours but no suitable period", () => {
    expect(dateCellText(day, activityDay(null))).toBe("✗ None")
  })

  it("says No hours left when today has no planning hour left", () => {
    expect(dateCellText({ ...day, hours: [] }, activityDay(null))).toBe(
      "No hours left",
    )
  })
})

describe("placeCellText", () => {
  it("gives the nearest place's name", () => {
    expect(placeCellText([nemunoSlipway, lampedziai])).toBe("Nemuno slipway")
  })

  it("flags an activity without a place", () => {
    expect(placeCellText([])).toBe("✗ No place found")
  })
})

describe("missingCellText", () => {
  it("says what is being asked for again during a Retry", () => {
    expect(missingCellText("retrying", "Getting nearby places…")).toBe(
      "Getting nearby places…",
    )
  })

  it("says Not available after a failure", () => {
    expect(missingCellText("unavailable", "Getting the forecast…")).toBe(
      "Not available",
    )
  })
})
