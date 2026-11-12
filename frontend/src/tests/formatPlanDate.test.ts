import { describe, expect, it } from "vitest"
import {
  formatPlanDate,
  formatPlanDateLong,
  formatPlanDateShort,
} from "../helpers/formatPlanDate"

describe("formatPlanDate", () => {
  it.each([
    ["2026-11-07", "Sat 7 Nov 2026"],
    ["2026-11-08", "Sun 8 Nov 2026"],
    ["2026-11-10", "Tue 10 Nov 2026"],
    ["2026-12-31", "Thu 31 Dec 2026"],
    ["2027-01-01", "Fri 1 Jan 2027"],
  ])("shows %s as %s", (isoDate, expected) => {
    expect(formatPlanDate(isoDate)).toBe(expected)
  })

  it("shows the same day whatever the time of day in the browser", () => {
    // Parsing "2026-11-07" as local time could move it to the 6th west of UTC.
    expect(formatPlanDate("2026-11-07")).toMatch(/^Sat 7 Nov/)
  })
})

describe("formatPlanDateLong", () => {
  it.each([
    ["2026-11-14", "Saturday 14 November 2026"],
    ["2026-11-15", "Sunday 15 November 2026"],
    ["2027-01-01", "Friday 1 January 2027"],
  ])("shows %s as %s", (isoDate, expected) => {
    expect(formatPlanDateLong(isoDate)).toBe(expected)
  })

  it("has no punctuation between the parts", () => {
    expect(formatPlanDateLong("2026-11-14")).not.toMatch(/,/)
  })
})

describe("formatPlanDateShort", () => {
  it.each([
    ["2026-11-14", "Sat 14 Nov"],
    ["2026-11-07", "Sat 7 Nov"],
    ["2027-01-01", "Fri 1 Jan"],
  ])("shows %s as %s, without the year", (isoDate, expected) => {
    expect(formatPlanDateShort(isoDate)).toBe(expected)
  })
})
