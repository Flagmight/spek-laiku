import type { PlanPeriod } from "../types/planSetup"

const isoDate = /^\d{4}-\d{2}-\d{2}$/

// Checks a date before it is added, for immediate feedback (spec FR-011). The forecast period and the
// maximum come from the server (GET /api/plan-setup/period); nothing here knows a date or a limit of
// its own, and the server checks everything again on Continue (constitution I, research section 6).
// yyyy-MM-dd strings compare correctly as text. Messages have no "Error: " prefix.
export function checkNewDate(
  date: string,
  existing: string[],
  period: PlanPeriod,
): string | null {
  // The browser gives an empty value for a date it could not read.
  if (!isoDate.test(date)) {
    return "Choose a date first."
  }

  if (existing.includes(date)) {
    return "This date is already added."
  }

  if (date < period.firstDate) {
    return "Dates cannot be in the past."
  }

  if (date > period.lastDate) {
    return "Forecast is not available that far ahead."
  }

  if (existing.length >= period.maxDates) {
    return `You can add up to ${period.maxDates} dates.`
  }

  return null
}

// A date kept from earlier in the session that has passed since (spec FR-018).
export function checkKeptDate(date: string, period: PlanPeriod): string | null {
  return date < period.firstDate ? "Dates cannot be in the past." : null
}
