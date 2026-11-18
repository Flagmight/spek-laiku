import { scheduleReasonText, travelSummaryText } from "../helpers/scheduleText"
import type { PlanSchedule, ScheduledActivity } from "../types/planSchedule"
import { ScheduledDaySection } from "./scheduledDaySection"

// A schedule as the Schedule Overview shows it (feature 008 spec FR-017 to FR-019, FR-036; feature 009
// FR-007, FR-008): the summaries, the activities per date in start-time order and the activities that could
// not be scheduled. Shared with the saved plan page, which shows a saved schedule the same way (feature 010
// spec User Story 4, research section 12).
export function ScheduleView({ schedule }: { schedule: PlanSchedule }) {
  const { scheduled, unscheduled, travel } = schedule
  const allUnscheduled = scheduled.length === 0 && unscheduled.length > 0
  const travelSummary = travelSummaryText(scheduled, travel)

  // Group scheduled activities by date, sorted ascending.
  const byDate = new Map<string, ScheduledActivity[]>()
  for (const activity of scheduled) {
    const existing = byDate.get(activity.date) ?? []
    existing.push(activity)
    byDate.set(activity.date, existing)
  }
  const sortedDates = [...byDate.keys()].sort()
  for (const date of sortedDates) {
    byDate.get(date)!.sort((a, b) => a.startTime.localeCompare(b.startTime))
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
          {sortedDates.map((date) => (
            <ScheduledDaySection
              key={date}
              date={date}
              activities={byDate.get(date)!}
              maxDistanceKm={travel.maxDistanceKm}
            />
          ))}
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
