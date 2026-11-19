import {
  changesFailedMessage,
  planGoneSaveAsNewMessage,
  useSavePlanStore,
} from "../stores/useSavePlanStore"
import type { SavePlanStatus as Status } from "../stores/useSavePlanStore"

// The status slot of the Save plan and Save changes form (feature 010 spec FR-004, FR-005; feature 011 spec
// FR-011, FR-012): saving, an expired schedule with Generate again, a server error with Retry, and a plan that
// was deleted while it was being edited, with Save plan to keep the new schedule as a new plan.
export function SavePlanStatus({
  status,
  savingChanges,
  onGenerateAgain,
  onSaveAsNew,
}: {
  status: Status
  savingChanges: boolean
  onGenerateAgain: () => void
  onSaveAsNew: () => void
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

  if (status === "planGone") {
    return (
      <p role="alert">
        {planGoneSaveAsNewMessage}{" "}
        <button type="button" onClick={onSaveAsNew}>
          Save plan
        </button>
      </p>
    )
  }

  if (status === "serverError") {
    return (
      <p role="alert">
        {savingChanges
          ? changesFailedMessage
          : "Error: Plan could not be saved. Try again."}{" "}
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
