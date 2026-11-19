import { useEffect, useRef } from "react"
import { Link, useNavigate } from "react-router-dom"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import {
  changesSavedMessage,
  useSavePlanStore,
} from "../stores/useSavePlanStore"
import type { NavigationState } from "../types/navigationState"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { CheckedPlanSetup } from "../types/planSetup"
import { PlanNameForm } from "./planNameForm"
import { SavePlanStatus } from "./savePlanStatus"

const visitorHintId = "save-plan-hint"
const logInToSave = "/login?returnTo=" + encodeURIComponent("/plan/schedule")

// "Save plan" on the Schedule Overview (feature 010 spec User Stories 1 and 2, FR-001 to FR-007). A signed-in,
// Active Registered User names and saves the schedule; only its remembered id and the name are sent. A Visitor,
// or a user whose session ended while saving, is sent to Log in with the schedule kept, and comes back to it.
// Nothing is offered when no activity was scheduled. onGenerateAgain replaces an expired schedule, keeping the
// form and the name. While a saved plan is being edited, the same form is "Save changes" and replaces that plan
// (feature 011 spec FR-009 to FR-012).
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
  const nameRefusals = useSavePlanStore((state) => state.nameRefusals)
  // The plan the last submission saved changes to; it is kept after the edit ends, for the success message.
  const changedPlanId = useSavePlanStore(
    (state) => state.lastSubmission?.planId,
  )
  const edit = usePlanEditStore((state) => state.edit)
  const editing = edit !== null && edit.ownerEmail === user?.email
  const saveButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (status === "closed" && returnFocus.current) {
      returnFocus.current = false
      saveButton.current?.focus()
    }
  }, [status])

  // Saving changes ends the edit; the setup and activities stay as the plan in progress (feature 011 FR-010).
  useEffect(() => {
    if (status === "saved" && changedPlanId) {
      const planEdit = usePlanEditStore.getState()
      if (planEdit.edit?.planId === changedPlanId) {
        planEdit.clear()
      }
    }
  }, [status, changedPlanId])

  // The session ended while saving: keep the schedule and log in again (spec Edge Cases). The user is marked
  // signed out first, so the Log in page opens instead of sending a still "signed-in" user home.
  useEffect(() => {
    if (status === "sessionExpired") {
      useKeptScheduleStore.getState().keep(setup, activities, schedule)
      useCurrentUserStore.getState().markSessionEnded()
      const state: NavigationState = { loginReason: "expired" }
      navigate(logInToSave, { state })
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
    // Save changes starts with the plan's current name (feature 011 FR-009).
    const open = () => {
      if (editing) {
        store.setName(edit.planName)
      }
      store.open()
    }
    return (
      <p>
        <button type="button" ref={saveButton} onClick={open}>
          {editing ? "Save changes" : "Save plan"}
        </button>
      </p>
    )
  }

  if (status === "saved") {
    return changedPlanId ? (
      <p role="status">
        {changesSavedMessage}{" "}
        <Link to={`/plans/${changedPlanId}`}>Open plan</Link>
      </p>
    ) : (
      <p role="status">
        ✓ Success: Plan saved. <Link to="/plans">Go to My plans</Link>
      </p>
    )
  }

  function cancel() {
    returnFocus.current = true
    store.cancel()
  }

  // The edited plan is gone: keep the new schedule by saving it as a new plan, with the name kept.
  function saveAsNew() {
    usePlanEditStore.getState().clear()
    store.saveAsNew()
  }

  const label = editing ? "Save changes" : "Save plan"
  return (
    <PlanNameForm
      formLabel={label}
      submitLabel={editing ? "Save changes" : "Save"}
      name={name}
      nameError={nameError}
      nameRefusals={nameRefusals}
      opened={status === "open"}
      busy={status === "saving"}
      onNameChange={store.setName}
      onSubmit={() =>
        // The edited plan is gone, so submitting again would only get the same answer (feature 011 code review).
        status === "planGone"
          ? saveAsNew()
          : void store.submit({
              generatedScheduleId: schedule.generatedScheduleId,
              planId: editing ? edit.planId : undefined,
              setup,
              activities,
            })
      }
      onCancel={cancel}
    >
      <SavePlanStatus
        status={status}
        savingChanges={editing}
        onGenerateAgain={onGenerateAgain}
        onSaveAsNew={saveAsNew}
      />
    </PlanNameForm>
  )
}
