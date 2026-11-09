import type { FieldError } from "../components/errorSummary"
import type {
  PlanActivity,
  PlanActivityErrors,
  PlanActivityField,
} from "../types/planActivity"

// The heading the list-level message points at.
export const planActivitiesHeadingId = "plan-activities-heading"

// In page order within an activity.
const fields: PlanActivityField[] = [
  "activity",
  "durationHours",
  "maxWindMs",
  "maxRainMmPerHour",
  "minTemperatureC",
  "maxTemperatureC",
]

// "activity" is the whole activity's group.
export function activityFieldId(id: string, field: PlanActivityField): string {
  return field === "activity" ? `activity-${id}` : `activity-${id}-${field}`
}

// Every message in page order, for the error summary and the first focus. Activities that are no
// longer in the plan are left out, and each message names its activity.
export function planActivitySummaryErrors(
  errors: PlanActivityErrors,
  activities: PlanActivity[],
  names: Record<string, string>,
): FieldError[] {
  const summary: FieldError[] = errors.list
    ? [{ fieldId: planActivitiesHeadingId, message: errors.list }]
    : []
  for (const { id } of activities) {
    for (const field of fields) {
      const message = errors.byActivity[id]?.[field]
      if (message) {
        summary.push({
          fieldId: activityFieldId(id, field),
          message: `${names[id]}: ${message}`,
        })
      }
    }
  }

  return summary
}
