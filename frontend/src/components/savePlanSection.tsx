import { useEffect, useRef } from "react"
import type { KeyboardEvent } from "react"
import { Link } from "react-router-dom"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useSavePlanStore } from "../stores/useSavePlanStore"
import type { PlanSchedule } from "../types/planSchedule"
import { TextField } from "./textField"

const nameFieldId = "plan-name"

// "Save plan" on the Schedule Overview for a signed-in, Active Registered User (feature 010 spec User Story 1,
// FR-001 to FR-005). Only the remembered schedule's id and the name are sent. Nothing is offered when no
// activity was scheduled. onGenerateAgain replaces an expired schedule, keeping the form and the name.
export function SavePlanSection({
  schedule,
  onGenerateAgain,
}: {
  schedule: PlanSchedule
  onGenerateAgain: () => void
}) {
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

  if (schedule.scheduled.length === 0 || !canViewSavedPlans(userStatus, user)) {
    return null
  }

  const store = useSavePlanStore.getState()

  if (status === "closed") {
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
