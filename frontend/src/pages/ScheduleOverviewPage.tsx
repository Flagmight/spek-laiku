import { useEffect } from "react"
import { Link, Navigate } from "react-router-dom"
import { PlanProgress } from "../components/planProgress"
import { SavePlanSection } from "../components/savePlanSection"
import { ScheduleView } from "../components/scheduleView"
import { usePageTitle } from "../hooks/usePageTitle"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanScheduleStore } from "../stores/usePlanScheduleStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { useSavePlanStore } from "../stores/useSavePlanStore"

// Step 4 of a plan (spec FR-017 to FR-019, FR-036): the generated schedule, unscheduled activities and
// error states, and saving the schedule (feature 010). Generated on mount; the schedule and the Save plan
// form are reset when the page closes (spec FR-014).
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
    useSavePlanStore.getState().reset()
    // A schedule kept on the way to Log in or Register is shown again instead of a new one, as long as the
    // plan has not changed since (feature 010 spec FR-007).
    // It is only read here; it is cleared below once shown, because StrictMode runs this effect twice.
    const kept = useKeptScheduleStore.getState().find(setup, activities)
    if (kept) {
      usePlanScheduleStore.getState().restore(kept)
    } else {
      void generate(setup, activities)
    }
    return () => {
      reset()
      useSavePlanStore.getState().reset()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A kept schedule is shown once: after this, leaving and coming back generates a new one (feature 008 FR-014).
  useEffect(() => {
    if (status === "loaded") {
      useKeptScheduleStore.getState().clear()
    }
  }, [status])

  if (status === "setupOutdated" || (!setup && status !== "loading")) {
    return <Navigate to="/plan/setup" replace />
  }

  if (
    status === "activitiesOutdated" ||
    (!activities && status !== "loading")
  ) {
    return <Navigate to="/plan/activities" replace />
  }

  // The remembered schedule expired: generate a new one and keep the Save plan form with its name
  // (feature 010 spec FR-004).
  function generateAgain() {
    if (setup && activities) {
      useSavePlanStore.getState().reopen()
      void generate(setup, activities)
    }
  }

  return (
    <>
      <h1>Schedule overview</h1>
      <PlanProgress current={4} />
      <ScheduleBody status={status} schedule={schedule} onRetry={retry} />
      {status === "loaded" && schedule && setup && activities && (
        <SavePlanSection
          setup={setup}
          activities={activities}
          schedule={schedule}
          onGenerateAgain={generateAgain}
        />
      )}
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

  return schedule ? <ScheduleView schedule={schedule} /> : null
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
