import { useEffect, useRef } from "react"
import { useRenamePlanStore } from "../stores/useRenamePlanStore"
import type { SavedPlan, SavedPlanSummary } from "../types/savedPlan"
import { EditPlanButton } from "./editPlanButton"
import { PlanActionMessages } from "./planActionMessages"
import { PlanActions } from "./planActions"
import { RenamePlanForm } from "./renamePlanForm"

// The plan page's actions (feature 011 spec FR-019): Edit plan, Rename, Duplicate and Delete, and their messages.
// While the Rename form is open it takes the place of the buttons; closing it returns focus to Rename.
export function PlanDetailsActions({
  plan,
  onDeleted,
  onDuplicated,
}: {
  plan: SavedPlan
  onDeleted: () => void
  onDuplicated: (copy: SavedPlanSummary) => void
}) {
  const renameStatus = useRenamePlanStore((state) => state.status)
  const renameButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const renaming = renameStatus !== "closed" && renameStatus !== "renamed"

  useEffect(() => {
    if (!renaming && returnFocus.current) {
      returnFocus.current = false
      renameButton.current?.focus()
    }
  }, [renaming])

  // The form belongs to this plan only.
  useEffect(() => () => useRenamePlanStore.getState().reset(), [plan.id])

  if (renaming) {
    return (
      <RenamePlanForm
        planId={plan.id}
        onClose={() => {
          returnFocus.current = true
        }}
      />
    )
  }

  return (
    <>
      <p className="plan-actions">
        <EditPlanButton plan={plan} />{" "}
        <button
          type="button"
          ref={renameButton}
          onClick={() => {
            returnFocus.current = true
            useRenamePlanStore.getState().open(plan.name)
          }}
        >
          Rename
        </button>
        <PlanActions
          plan={plan}
          onDeleted={onDeleted}
          onDuplicated={onDuplicated}
        />
      </p>
      <PlanActionMessages />
    </>
  )
}
