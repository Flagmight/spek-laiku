import { useEffect, useRef } from "react"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import { useRenamePlanStore } from "../stores/useRenamePlanStore"
import type { SavedPlan, SavedPlanSummary } from "../types/savedPlan"
import { EditPlanButton } from "./editPlanButton"
import { PlanActionMessages } from "./planActionMessages"
import { PlanActions } from "./planActions"
import { RenamePlanForm } from "./renamePlanForm"

// The plan page's actions (feature 011 spec FR-019; feature 012 spec FR-017): Edit plan, Recalculate, Rename,
// Duplicate and Delete, and their messages. Recalculate checks the plan again against the latest forecast; it is
// disabled while a check runs and not offered once every scheduled activity has started.
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
  const checkStatus = usePlanCheckStore((state) => state.status)
  const renameButton = useRef<HTMLButtonElement>(null)
  const recalculateButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const returnFocusToRecalculate = useRef(false)
  const renaming = renameStatus !== "closed" && renameStatus !== "renamed"
  const checking = checkStatus === "checking"

  useEffect(() => {
    if (!renaming && returnFocus.current) {
      returnFocus.current = false
      renameButton.current?.focus()
    }
  }, [renaming])

  // A disabled button loses focus; it gets it back when the check it started has ended.
  useEffect(() => {
    if (!checking && returnFocusToRecalculate.current) {
      returnFocusToRecalculate.current = false
      recalculateButton.current?.focus()
    }
  }, [checking])

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
        {checkStatus !== "allPast" && (
          <>
            <button
              type="button"
              className="plan-recalculate"
              ref={recalculateButton}
              disabled={checking}
              onClick={() => {
                returnFocusToRecalculate.current = true
                void usePlanCheckStore.getState().check(plan.id)
              }}
            >
              Recalculate
            </button>{" "}
          </>
        )}
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
