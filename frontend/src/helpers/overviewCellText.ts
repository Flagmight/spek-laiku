import type { StepPartState } from "./stepPartState"
import type { ActivityDayForecast, ForecastDay } from "../types/planForecast"
import type { NearbyPlace } from "../types/planPlaces"

// A date cell of the step 3 overview (feature 007 FR-016): the longest suitable period the server chose,
// "✗ None" without one, or "No hours left" on today's date when no planning hour is left. ", too short"
// comes from the server's shorterThanDuration, not from comparing with the duration here.
export function dateCellText(
  day: ForecastDay,
  activityDay: ActivityDayForecast,
): string {
  if (day.hours.length === 0) {
    return "No hours left"
  }

  const period = activityDay.longestPeriod
  if (!period) {
    return "✗ None"
  }

  const text = `★ ${period.start}–${period.end} (${period.lengthHours} h)`
  return period.shorterThanDuration ? `${text}, too short` : text
}

// A "Place" cell: the nearest place's name, or the no-place flag (feature 007 FR-016, FR-019).
export function placeCellText(places: NearbyPlace[]): string {
  return places[0]?.name ?? "✗ No place found"
}

// A cell whose part of the step has no data: being asked for again, or not available (feature 007 FR-009,
// FR-016).
export function missingCellText(
  state: Exclude<StepPartState, "loaded">,
  retryingText: string,
): string {
  return state === "retrying" ? retryingText : "Not available"
}
