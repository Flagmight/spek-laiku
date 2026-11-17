import { describe, expect, it } from "vitest"
import { travelSummaryText, travelText } from "../helpers/scheduleText"
import type { ScheduledActivity, TravelLeg } from "../types/planSchedule"

function trip(distanceKm: number, overLimit = false): TravelLeg {
  return { fromPlaceName: "Slipway", distanceKm, overLimit }
}

function activity(travel: TravelLeg | null): ScheduledActivity {
  return {
    activityName: "Kayaking",
    date: "2026-11-14",
    startTime: "08:00",
    endTime: "11:00",
    place: {
      name: "Slipway",
      latitude: 54.9,
      longitude: 23.9,
      distanceKm: 1,
      area: null,
    },
    weather: {
      temperatureC: 12,
      rainMmPerHour: 0,
      windMs: 3,
      isIndoor: false,
    },
    travel,
  }
}

describe("travelText", () => {
  it("words the first activity of a date as the start of the day", () => {
    expect(travelText(null, 30)).toBe("Travel: Start of the day")
  })

  it("words a trip with its distance and the previous place", () => {
    expect(
      travelText(
        { fromPlaceName: "Kaunas Castle", distanceKm: 4.2, overLimit: false },
        30,
      ),
    ).toBe("Travel: 4.2 km from Kaunas Castle")
  })

  it("keeps the decimal place for a zero trip and a whole number", () => {
    expect(travelText(trip(0), 30)).toBe("Travel: 0.0 km from Slipway")
    expect(travelText(trip(12), 30)).toBe("Travel: 12.0 km from Slipway")
  })

  it("marks a trip over the limit with ✗ and the limit in words", () => {
    expect(travelText(trip(42, true), 30)).toBe(
      "Travel: ✗ 42.0 km from Slipway, more than your 30 km limit",
    )
  })

  it("does not mark a trip at the limit, because the server did not flag it", () => {
    expect(travelText(trip(30), 30)).toBe("Travel: 30.0 km from Slipway")
  })
})

describe("travelSummaryText", () => {
  it("has no summary when no date has two or more activities", () => {
    expect(
      travelSummaryText([activity(null), activity(null)], {
        maxDistanceKm: 30,
        tripsOverLimit: 0,
      }),
    ).toBeNull()
    expect(
      travelSummaryText([], { maxDistanceKm: 30, tripsOverLimit: 0 }),
    ).toBeNull()
  })

  it("says all trips are within the limit when none is over", () => {
    expect(
      travelSummaryText([activity(null), activity(trip(4.2))], {
        maxDistanceKm: 30,
        tripsOverLimit: 0,
      }),
    ).toBe("✓ All trips within your 30 km limit.")
  })

  it("counts one trip over the limit in the singular", () => {
    expect(
      travelSummaryText([activity(null), activity(trip(42, true))], {
        maxDistanceKm: 30,
        tripsOverLimit: 1,
      }),
    ).toBe("✗ 1 trip longer than your 30 km limit.")
  })

  it("counts several trips over the limit in the plural", () => {
    expect(
      travelSummaryText(
        [activity(null), activity(trip(42, true)), activity(trip(35, true))],
        { maxDistanceKm: 5, tripsOverLimit: 3 },
      ),
    ).toBe("✗ 3 trips longer than your 5 km limit.")
  })
})
