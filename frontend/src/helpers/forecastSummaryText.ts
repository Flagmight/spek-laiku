import type { ActivityForecast } from "../types/planForecast"

// The line at the top of an activity's forecast (spec FR-022). Wording only: the server counted the hours
// and dates and decided whether any period is long enough.
export function forecastSummaryText(
  forecast: ActivityForecast,
  totalDates: number,
  durationHours: number,
): string {
  if (forecast.suitableHours === 0) {
    return "No suitable hours on any of your dates. Try other dates or change this activity's limits."
  }

  const dates = totalDates === 1 ? "date" : "dates"
  const summary = `Suitable hours: ${forecast.suitableHours} on ${forecast.datesWithSuitableHours} of ${totalDates} ${dates}.`

  return forecast.hasLongEnoughPeriod
    ? summary
    : `${summary} No period is long enough for this activity's ${String(durationHours)} h.`
}
