import { useRef, useState } from "react"
import { usePlanActionsStore } from "../stores/usePlanActionsStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import type { PlanActionResult } from "../stores/usePlanActionsStore"
import type { SavedPlanSummary } from "../types/savedPlan"
import { ConfirmDialog } from "./confirmDialog"

// Duplicate and Delete on one saved plan, on My plans rows and on the plan page (feature 011 spec FR-002,
// FR-004, FR-019, FR-020). Duplicate needs no confirmation; Delete asks first, and Cancel or Escape returns
// focus to the Delete button. Each button names its plan for screen readers, and all are disabled while any
// plan action is running. The result handlers also run when Retry repeats an action.
export function PlanActions({
  plan,
  onDeleted,
  onDuplicated,
  onGone,
}: {
  plan: { id: string; name: string }
  onDeleted: (planId: string) => void
  onDuplicated: (copy: SavedPlanSummary) => void
  // Called when the plan turns out to be already deleted, for example in another tab. Without it, the store's
  // "This plan no longer exists." is shown where the user is (research section 12).
  onGone?: (planId: string) => void
}) {
  const pending = usePlanActionsStore((state) => state.pending)
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const duplicateButton = useRef<HTMLButtonElement>(null)
  // One action runs at a time on the page, so every plan's buttons wait for it (feature 011 code review).
  const busy = pending !== null

  function cancel() {
    setConfirming(false)
    deleteButton.current?.focus()
  }

  // Shared by both actions: a plan that is gone is handled the same way whichever action found out.
  function settle(
    result: PlanActionResult,
    button: HTMLButtonElement | null,
  ): void {
    if (result === "gone" && onGone) {
      onGone(plan.id)
    } else if (result !== "ignored") {
      button?.focus()
    }
  }

  function onDeleteResult(result: PlanActionResult) {
    setConfirming(false)
    if (result === "deleted") {
      // An edit of the deleted plan can no longer be saved over it (spec Edge Cases).
      if (usePlanEditStore.getState().edit?.planId === plan.id) {
        usePlanEditStore.getState().clear()
      }
      onDeleted(plan.id)
    } else {
      settle(result, deleteButton.current)
    }
  }

  function onDuplicateResult(result: PlanActionResult) {
    if (typeof result === "object") {
      duplicateButton.current?.focus()
      onDuplicated(result.copy)
    } else {
      settle(result, duplicateButton.current)
    }
  }

  return (
    <>
      {" "}
      <button
        type="button"
        ref={duplicateButton}
        aria-label={`Duplicate ${plan.name}`}
        disabled={busy}
        onClick={() =>
          void usePlanActionsStore
            .getState()
            .duplicatePlan(plan.id, onDuplicateResult)
        }
      >
        Duplicate
      </button>{" "}
      <button
        type="button"
        ref={deleteButton}
        aria-label={`Delete ${plan.name}`}
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
      {confirming && (
        <ConfirmDialog
          question={`Delete '${plan.name}'? This cannot be undone.`}
          confirmLabel="Delete"
          busy={busy}
          onConfirm={() =>
            void usePlanActionsStore
              .getState()
              .deletePlan(plan.id, onDeleteResult)
          }
          onCancel={cancel}
        />
      )}
    </>
  )
}
