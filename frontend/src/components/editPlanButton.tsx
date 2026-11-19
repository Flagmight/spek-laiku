import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { hasPlanInProgress } from "../helpers/hasPlanInProgress"
import { fillPlanFromSavedPlan } from "../helpers/planFromSavedPlan"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import type { SavedPlan } from "../types/savedPlan"
import { ConfirmDialog } from "./confirmDialog"

export const replacePlanQuestion =
  "Editing this plan replaces the plan you have not saved. Continue?"

// "Edit plan" on the plan page (feature 011 spec FR-007, FR-013): loads the saved plan into the planning steps
// and opens Plan Setup. When the tab holds a plan that is not saved, it asks first; Cancel or Escape keeps that
// plan and returns focus to the button.
export function EditPlanButton({ plan }: { plan: SavedPlan }) {
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const button = useRef<HTMLButtonElement>(null)

  function startEditing() {
    const user = useCurrentUserStore.getState().user
    if (!user) {
      return
    }

    fillPlanFromSavedPlan(plan)
    useKeptScheduleStore.getState().clear()
    usePlanEditStore.getState().start({
      planId: plan.id,
      planName: plan.name,
      ownerEmail: user.email,
    })
    navigate("/plan/setup")
  }

  function cancel() {
    setConfirming(false)
    button.current?.focus()
  }

  return (
    <>
      <button
        type="button"
        ref={button}
        onClick={() =>
          hasPlanInProgress() ? setConfirming(true) : startEditing()
        }
      >
        Edit plan
      </button>
      {confirming && (
        <ConfirmDialog
          question={replacePlanQuestion}
          confirmLabel="Continue"
          onConfirm={startEditing}
          onCancel={cancel}
        />
      )}
    </>
  )
}
