import { describe, expect, it } from "vitest"
import {
  formatPlanDates,
  formatSavedAt,
  formatSavedDate,
} from "../helpers/formatSavedAt"

describe("formatSavedAt", () => {
  it("shows a winter time in Lithuanian time (UTC+2)", () => {
    expect(formatSavedAt("2026-11-21T12:05:00Z")).toBe(
      "Saved on Sat 21 Nov 2026 at 14:05",
    )
  })

  it("shows a summer time in Lithuanian time (UTC+3)", () => {
    expect(formatSavedAt("2026-07-04T21:30:00Z")).toBe(
      "Saved on Sun 5 Jul 2026 at 00:30",
    )
  })

  it("shows the date alone for the plan page's note", () => {
    expect(formatSavedDate("2026-11-21T12:05:00Z")).toBe("Sat 21 Nov 2026")
  })
})

describe("formatPlanDates", () => {
  it("joins the dates with commas, even when they do not follow each other", () => {
    expect(formatPlanDates(["2026-11-21", "2026-11-22", "2026-11-25"])).toBe(
      "Sat 21 Nov, Sun 22 Nov, Wed 25 Nov",
    )
  })

  it("shows one date", () => {
    expect(formatPlanDates(["2026-11-21"])).toBe("Sat 21 Nov")
  })
})
