import { scheduleReasonText, travelSummaryText } from "../helpers/scheduleText"
import type { PlanCheckEntry } from "../types/planCheck"
import type { PlanSchedule, ScheduledActivity } from "../types/planSchedule"
import { ScheduledDaySection } from "./scheduledDaySection"

// A schedule as the Schedule Overview shows it (feature 008 spec FR-017 to FR-019, FR-036; feature 009
// FR-007, FR-008): the summaries, the activities per date in start-time order and the activities that could
// not be scheduled. Shared with the saved plan page, which shows a saved schedule the same way (feature 010
// spec User Story 4, research section 12). The plan page also passes the plan check's entries, aligned by
// position with schedule.scheduled (feature 012 research section 14).
export function ScheduleView({
  schedule,
  checks,
}: {
  schedule: PlanSchedule
  checks?: PlanCheckEntry[]
}) {
  const { scheduled, unscheduled, travel } = schedule
  const allUnscheduled = scheduled.length === 0 && unscheduled.length > 0
  const travelSummary = travelSummaryText(scheduled, travel)

  // Group scheduled activities by date, sorted ascending, keeping each one's position in the schedule.
  const byDate = new Map<
    string,
    { activity: ScheduledActivity; index: number }[]
  >()
  scheduled.forEach((activity, index) => {
    const existing = byDate.get(activity.date) ?? []
    existing.push({ activity, index })
    byDate.set(activity.date, existing)
  })
  const sortedDates = [...byDate.keys()].sort()
  for (const date of sortedDates) {
    byDate
      .get(date)!
      .sort((a, b) => a.activity.startTime.localeCompare(b.activity.startTime))
  }

  return (
    <>
      {(unscheduled.length === 0 || travelSummary) && (
        // One status region for both summaries (feature 009 research section 9).
        <div role="status">
          {unscheduled.length === 0 && <p>✓ All activities scheduled.</p>}
          {travelSummary && <p>{travelSummary}</p>}
        </div>
      )}
      {allUnscheduled && (
        <p>
          No suitable time found for any activity. Change the dates or the
          weather limits.
        </p>
      )}
      {sortedDates.length > 0 && (
        <section aria-label="Scheduled activities">
          {sortedDates.map((date) => {
            const entries = byDate.get(date)!
            return (
              <ScheduledDaySection
                key={date}
                date={date}
                activities={entries.map(({ activity }) => activity)}
                maxDistanceKm={travel.maxDistanceKm}
                checks={
                  checks &&
                  entries.map(({ index }) => ({ index, check: checks[index] }))
                }
              />
            )
          })}
        </section>
      )}
      {unscheduled.length > 0 && (
        <section aria-label="Could not be scheduled">
          <h2>Could not be scheduled</h2>
          <ul>
            {unscheduled.map((activity) => (
              <li key={activity.activityName}>
                {activity.activityName}: {scheduleReasonText(activity.reason)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
