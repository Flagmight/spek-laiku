import { kmText } from "../helpers/placeText"
import { scheduleWeatherText, travelText } from "../helpers/scheduleText"
import type { ScheduledActivity } from "../types/planSchedule"

// One date of the Schedule Overview: its heading and its activities in start-time order, each with
// its time, name, place, weather and the trip from the previous activity (feature 008 spec FR-007,
// FR-008; feature 009 spec FR-007). The activities arrive already sorted by start time;
// maxDistanceKm is the limit the server checked the trips against, used only for the wording.
export function ScheduledDaySection({
  date,
  activities,
  maxDistanceKm,
}: {
  date: string
  activities: ScheduledActivity[]
  maxDistanceKm: number
}) {
  return (
    <section aria-label={date}>
      <h2>{date}</h2>
      <ul>
        {activities.map((activity) => (
          <li
            key={`${activity.date}-${activity.startTime}-${activity.activityName}`}
          >
            <span>
              {activity.startTime}–{activity.endTime}
            </span>{" "}
            <span>{activity.activityName}</span>{" "}
            <span>
              {activity.place.name} ({kmText(activity.place.distanceKm)})
            </span>{" "}
            <span>{scheduleWeatherText(activity.weather)}</span>{" "}
            <span>{travelText(activity.travel, maxDistanceKm)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
