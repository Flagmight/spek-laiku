import { describe, expect, it } from "vitest"
import { formatPlanDate } from "../helpers/formatPlanDate"

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
