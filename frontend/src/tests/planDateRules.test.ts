import { describe, expect, it } from "vitest"
import { checkKeptDate, checkNewDate } from "../helpers/planDateRules"
import type { PlanPeriod } from "../types/planSetup"

// As the server sends it; the helpers hold no dates or limits of their own.
const period: PlanPeriod = {
  firstDate: "2026-11-04",
  lastDate: "2026-11-10",
  maxDates: 7,
}

describe("checkNewDate", () => {
  it.each(["", "2026-11", "07/11/2026", "not a date"])(
    "asks for a date when the value is %j",
    (value) => {
      expect(checkNewDate(value, [], period)).toBe("Choose a date first.")
    },
  )

  it("refuses a date that is already added", () => {
    expect(checkNewDate("2026-11-07", ["2026-11-07"], period)).toBe(
      "This date is already added.",
    )
  })

  it("refuses the day before the period", () => {
    expect(checkNewDate("2026-11-03", [], period)).toBe(
      "Dates cannot be in the past.",
    )
  })

  it("refuses the day after the period", () => {
    expect(checkNewDate("2026-11-11", [], period)).toBe(
      "Forecast is not available that far ahead.",
    )
  })

  it.each(["2026-11-04", "2026-11-10"])(
    "accepts %s, the first and last day of the period",
    (date) => {
      expect(checkNewDate(date, [], period)).toBeNull()
    },
  )

  it("refuses another date when the server's maximum is reached", () => {
    const sevenDates = [4, 5, 6, 7, 8, 9].map((day) => `2026-11-0${day}`)
    expect(checkNewDate("2026-11-10", sevenDates, period)).toBeNull()

    expect(
      checkNewDate("2026-11-10", [...sevenDates, "2026-11-03"], period),
    ).toBe("You can add up to 7 dates.")
  })

  it("takes the maximum from the period, not from a constant", () => {
    const smallerPeriod = { ...period, maxDates: 3 }

    expect(
      checkNewDate(
        "2026-11-09",
        ["2026-11-04", "2026-11-05", "2026-11-06"],
        smallerPeriod,
      ),
    ).toBe("You can add up to 3 dates.")
  })

  it("compares dates across a month change", () => {
    const yearEnd = {
      firstDate: "2026-12-28",
      lastDate: "2027-01-03",
      maxDates: 7,
    }

    expect(checkNewDate("2027-01-03", [], yearEnd)).toBeNull()
    expect(checkNewDate("2026-12-27", [], yearEnd)).toBe(
      "Dates cannot be in the past.",
    )
  })
})

describe("checkKeptDate", () => {
  it("marks a kept date before the period as past", () => {
    expect(checkKeptDate("2026-11-03", period)).toBe(
      "Dates cannot be in the past.",
    )
  })

  it("accepts a kept date inside the period", () => {
    expect(checkKeptDate("2026-11-04", period)).toBeNull()
  })
})
