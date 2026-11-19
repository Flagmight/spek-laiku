import { useRef, useState } from "react"
import { usePlanActionsStore } from "../stores/usePlanActionsStore"
import { ConfirmDialog } from "./confirmDialog"

// The actions on one saved plan, on My plans rows and on the plan page (feature 011 spec FR-002, FR-019,
// FR-020). Delete asks for confirmation first; Cancel or Escape returns focus to the Delete button. Each
// button names its plan for screen readers, and both are disabled while an action of this plan is running.
export function PlanActions({
  plan,
  onDeleted,
  onGone,
}: {
  plan: { id: string; name: string }
  onDeleted: (planId: string) => void
  // Called when the plan turns out to be already deleted, for example in another tab. Without it, the store's
  // "This plan no longer exists." is shown where the user is (research section 12).
  onGone?: (planId: string) => void
}) {
  const pending = usePlanActionsStore((state) => state.pending)
  const [confirming, setConfirming] = useState(false)
  const deleteButton = useRef<HTMLButtonElement>(null)
  const busy = pending?.planId === plan.id

  function cancel() {
    setConfirming(false)
    deleteButton.current?.focus()
  }

  async function confirmDelete() {
    const result = await usePlanActionsStore.getState().deletePlan(plan.id)
    setConfirming(false)
    if (result === "deleted") {
      onDeleted(plan.id)
    } else if (result === "gone" && onGone) {
      onGone(plan.id)
    } else {
      deleteButton.current?.focus()
    }
  }

  return (
    <>
      {" "}
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
          onConfirm={() => void confirmDelete()}
          onCancel={cancel}
        />
      )}
    </>
  )
}
