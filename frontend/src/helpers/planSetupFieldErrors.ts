import type { FieldError } from "../components/errorSummary"
import type { PlanSetupFieldErrors } from "../types/planSetup"
import { formatPlanDate } from "./formatPlanDate"

// The inputs each error belongs to, so summary links and focus land on the right field.
export interface PlanSetupFieldIds {
  location: string
  date: string
  distance: string
}

const dateKey = /^dates\[(\d+)\]$/

// The dates[i] errors keyed by the date they point at in the request that was sent.
export function dateErrorsByDate(
  errors: PlanSetupFieldErrors,
  sentDates: string[],
): Record<string, string> {
  const byDate: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    const index = dateKey.exec(key)?.[1]
    const date = index === undefined ? undefined : sentDates[Number(index)]
    if (date && message) {
      byDate[date] = message
    }
  }

  return byDate
}

// Every message in field order (Location, Dates, each date, distance), for the error summary
// (spec FR-013). A date's message names the date: "Sat 7 Nov 2026: Dates cannot be in the past."
export function summaryErrors(
  errors: PlanSetupFieldErrors,
  sentDates: string[],
  ids: PlanSetupFieldIds,
): FieldError[] {
  const summary: FieldError[] = []
  if (errors.locationId) {
    summary.push({ fieldId: ids.location, message: errors.locationId })
  }

  if (errors.dates) {
    summary.push({ fieldId: ids.date, message: errors.dates })
  }

  const byDate = dateErrorsByDate(errors, sentDates)
  for (const date of Object.keys(byDate).sort()) {
    summary.push({
      fieldId: ids.date,
      message: `${formatPlanDate(date)}: ${byDate[date]}`,
    })
  }

  if (errors.maxTravelDistanceKm) {
    summary.push({ fieldId: ids.distance, message: errors.maxTravelDistanceKm })
  }

  return summary
}
