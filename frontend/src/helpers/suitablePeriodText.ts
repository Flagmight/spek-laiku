import type { SuitablePeriod } from "../types/planForecast"

// "★ Suitable 10:00–14:00 (4 h)", with ", shorter than this activity's 2 h" added when the server marked
// the period as too short for the activity (spec FR-021). Wording only: the server decided the mark.
export function suitablePeriodText(
  period: SuitablePeriod,
  durationHours: number,
): string {
  const text = `★ Suitable ${period.start}–${period.end} (${period.lengthHours} h)`

  return period.shorterThanDuration
    ? `${text}, shorter than this activity's ${String(durationHours)} h`
    : text
}
