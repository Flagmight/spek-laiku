import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { useSavePlanStore } from "../stores/useSavePlanStore"
import type { NavigationState } from "../types/navigationState"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { CheckedPlanSetup } from "../types/planSetup"
import { TextField } from "./textField"

const nameFieldId = "plan-name"
const visitorHintId = "save-plan-hint"
const logInToSave = "/login?returnTo=" + encodeURIComponent("/plan/schedule")

// "Save plan" on the Schedule Overview (feature 010 spec User Stories 1 and 2, FR-001 to FR-007). A signed-in,
// Active Registered User names and saves the schedule; only its remembered id and the name are sent. A Visitor,
// or a user whose session ended while saving, is sent to Log in with the schedule kept, and comes back to it.
// Nothing is offered when no activity was scheduled. onGenerateAgain replaces an expired schedule, keeping the
// form and the name.
export function SavePlanSection({
  setup,
  activities,
  schedule,
  onGenerateAgain,
}: {
  setup: CheckedPlanSetup
  activities: CheckedPlanActivity[]
  schedule: PlanSchedule
  onGenerateAgain: () => void
}) {
  const navigate = useNavigate()
  const userStatus = useCurrentUserStore((state) => state.status)
  const user = useCurrentUserStore((state) => state.user)
  const status = useSavePlanStore((state) => state.status)
  const name = useSavePlanStore((state) => state.name)
  const nameError = useSavePlanStore((state) => state.nameError)
  const saveButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  // Focus goes to the name field when the form opens and when the name is refused (spec User Story 7).
  useEffect(() => {
    if (status === "open" || nameError) {
      document.getElementById(nameFieldId)?.focus()
    }
  }, [nameError, status])

  useEffect(() => {
    if (status === "closed" && returnFocus.current) {
      returnFocus.current = false
      saveButton.current?.focus()
    }
  }, [status])

  // The session ended while saving: keep the schedule and log in again (spec Edge Cases).
  useEffect(() => {
    if (status === "sessionExpired") {
      useKeptScheduleStore.getState().keep(setup, activities, schedule)
      const state: NavigationState = { loginReason: "expired" }
      navigate(logInToSave, { state })
      void useCurrentUserStore.getState().refresh()
    }
  }, [status, setup, activities, schedule, navigate])

  if (schedule.scheduled.length === 0) {
    return null
  }

  if (userStatus === "signedOut" || userStatus === "error") {
    const logIn = () => {
      useKeptScheduleStore.getState().keep(setup, activities, schedule)
      const state: NavigationState = { loginReason: "required" }
      navigate(logInToSave, { state })
    }
    return (
      <p>
        <button type="button" aria-describedby={visitorHintId} onClick={logIn}>
          Save plan
        </button>{" "}
        <span id={visitorHintId}>Log in or register to save this plan.</span>
      </p>
    )
  }

  if (!canViewSavedPlans(userStatus, user)) {
    return null
  }

  const store = useSavePlanStore.getState()

  if (status === "closed" || status === "sessionExpired") {
    return (
      <p>
        <button type="button" ref={saveButton} onClick={store.open}>
          Save plan
        </button>
      </p>
    )
  }

  if (status === "saved") {
    return (
      <p role="status">
        ✓ Success: Plan saved. <Link to="/plans">Go to My plans</Link>
      </p>
    )
  }

  function cancel() {
    returnFocus.current = true
    store.cancel()
  }

  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      cancel()
    }
  }

  return (
    <form
      aria-label="Save plan"
      noValidate
      onKeyDown={onKeyDown}
      onSubmit={(event) => {
        event.preventDefault()
        void store.submit(schedule.generatedScheduleId)
      }}
    >
      <TextField
        id={nameFieldId}
        label="Plan name"
        type="text"
        autoComplete="off"
        value={name}
        error={nameError ?? undefined}
        onChange={store.setName}
      />
      <SaveStatus status={status} onGenerateAgain={onGenerateAgain} />
      <p>
        <button type="submit" disabled={status === "saving"}>
          Save
        </button>{" "}
        <button type="button" onClick={cancel}>
          Cancel
        </button>
      </p>
    </form>
  )
}

function SaveStatus({
  status,
  onGenerateAgain,
}: {
  status: ReturnType<typeof useSavePlanStore.getState>["status"]
  onGenerateAgain: () => void
}) {
  if (status === "saving") {
    return <p role="status">Saving your plan…</p>
  }

  if (status === "expired") {
    return (
      <p role="alert">
        Generate the schedule again to save it.{" "}
        <button type="button" onClick={onGenerateAgain}>
          Generate again
        </button>
      </p>
    )
  }

  if (status === "serverError") {
    return (
      <p role="alert">
        Error: Plan could not be saved. Try again.{" "}
        <button
          type="button"
          onClick={() => void useSavePlanStore.getState().retry()}
        >
          Retry
        </button>
      </p>
    )
  }

  return null
}
