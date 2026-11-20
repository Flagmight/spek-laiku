import { kmText } from "../helpers/placeText"
import { planProblemText, scheduledEntryId } from "../helpers/planProblemText"
import { scheduleWeatherText, travelText } from "../helpers/scheduleText"
import type { PlanCheckEntry } from "../types/planCheck"
import type { ScheduledActivity } from "../types/planSchedule"

// The check of one entry and the entry's position in the whole schedule, which names its id.
export interface ScheduledEntryCheck {
  index: number
  check: PlanCheckEntry
}

// One date of the Schedule Overview: its heading and its activities in start-time order, each with
// its time, name, place, weather and the trip from the previous activity (feature 008 spec FR-007,
// FR-008; feature 009 spec FR-007). The activities arrive already sorted by start time;
// maxDistanceKm is the limit the server checked the trips against, used only for the wording.
// On the saved plan page, checks (aligned with activities) add the latest weather, the problems and an id
// that a problem's link moves focus to (feature 012 spec FR-010, FR-011); without them nothing changes.
export function ScheduledDaySection({
  date,
  activities,
  maxDistanceKm,
  checks,
}: {
  date: string
  activities: ScheduledActivity[]
  maxDistanceKm: number
  checks?: ScheduledEntryCheck[]
}) {
  return (
    <section aria-label={date}>
      <h2>{date}</h2>
      <ul>
        {activities.map((activity, position) => {
          const entryCheck = checks?.[position]
          const check = entryCheck?.check
          return (
            <li
              key={`${activity.date}-${activity.startTime}-${activity.activityName}`}
              id={entryCheck ? scheduledEntryId(entryCheck.index) : undefined}
              tabIndex={entryCheck ? -1 : undefined}
            >
              <span>
                {activity.startTime}–{activity.endTime}
              </span>{" "}
              <span>{activity.activityName}</span>{" "}
              <span>
                {activity.place.name} ({kmText(activity.place.distanceKm)})
              </span>{" "}
              <span>
                {scheduleWeatherText(check?.weather ?? activity.weather)}
              </span>{" "}
              <span>{travelText(activity.travel, maxDistanceKm)}</span>
              {check && check.problems.length > 0 && (
                <div className="entry-problems">
                  <p>✗ Problem</p>
                  <ul>
                    {check.problems.map((problem, index) => (
                      <li key={`${problem.rule}-${index}`}>
                        {planProblemText(problem)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
