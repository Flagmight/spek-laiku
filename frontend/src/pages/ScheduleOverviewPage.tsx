import { useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { PlanProgress } from "../components/planProgress"
import {
  scheduleReasonText,
  scheduleWeatherText,
} from "../helpers/scheduleText"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanScheduleStore } from "../stores/usePlanScheduleStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { ScheduledActivity } from "../types/planSchedule"

// Step 4 of a plan (spec FR-017 to FR-019, FR-036): the generated schedule, unscheduled activities and
// error states. Generated on mount; reset when the page closes (spec FR-014).
export function ScheduleOverviewPage() {
  usePageTitle("Schedule overview")
  const setup = usePlanSetupStore((state) => state.checked)
  const activities = usePlanActivitiesStore((state) => state.checked)
  const status = usePlanScheduleStore((state) => state.status)
  const schedule = usePlanScheduleStore((state) => state.schedule)
  const generate = usePlanScheduleStore((state) => state.generate)
  const retry = usePlanScheduleStore((state) => state.retry)
  const reset = usePlanScheduleStore((state) => state.reset)

  useEffect(() => {
    if (!setup || !activities) {
      return
    }
    void generate(setup, activities)
    return () => reset()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "setupOutdated" || (!setup && status !== "loading")) {
    return <Navigate to="/plan/setup" replace />
  }

  if (
    status === "activitiesOutdated" ||
    (!activities && status !== "loading")
  ) {
    return <Navigate to="/plan/activities" replace />
  }

  return (
    <>
      <h1>Schedule overview</h1>
      <PlanProgress current={4} />
      <ScheduleBody status={status} schedule={schedule} onRetry={retry} />
      <p>
        <Link to="/plan/places" className="button-link">
          Back
        </Link>
      </p>
    </>
  )
}

type Status = ReturnType<typeof usePlanScheduleStore.getState>["status"]

function ScheduleBody({
  status,
  schedule,
  onRetry,
}: {
  status: Status
  schedule: ReturnType<typeof usePlanScheduleStore.getState>["schedule"]
  onRetry: () => void
}) {
  if (status === "loading" || status === "idle") {
    return <p>Generating your schedule…</p>
  }

  if (status === "weatherUnavailable") {
    return (
      <ServiceError
        message="The weather service is unavailable."
        onRetry={onRetry}
      />
    )
  }

  if (status === "placesUnavailable") {
    return (
      <ServiceError
        message="The map data service is unavailable. No places are shown."
        onRetry={onRetry}
      />
    )
  }

  if (status === "tooManyRequests") {
    return (
      <ServiceError
        message="Too many requests. Wait a minute and try again."
        onRetry={onRetry}
      />
    )
  }

  if (status === "serverError") {
    return (
      <ServiceError
        message="Something went wrong. Try again."
        onRetry={onRetry}
      />
    )
  }

  if (!schedule) {
    return null
  }

  const { scheduled, unscheduled } = schedule
  const allUnscheduled = scheduled.length === 0 && unscheduled.length > 0

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
      {unscheduled.length === 0 && (
        <p role="status">✓ All activities scheduled.</p>
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
            <section key={date} aria-label={date}>
              <h2>{date}</h2>
              <ul>
                {byDate.get(date)!.map((activity) => (
                  <li
                    key={`${activity.date}-${activity.startTime}-${activity.activityName}`}
                  >
                    <span>
                      {activity.startTime}–{activity.endTime}
                    </span>{" "}
                    <span>{activity.activityName}</span>{" "}
                    <span>
                      {activity.place.name} ({activity.place.distanceKm} km)
                    </span>{" "}
                    <span>{scheduleWeatherText(activity.weather)}</span>
                  </li>
                ))}
              </ul>
            </section>
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

function ServiceError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <p role="alert">
      Error: {message}{" "}
      <button type="button" onClick={onRetry}>
        Retry
      </button>
    </p>
  )
}
