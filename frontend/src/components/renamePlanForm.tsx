import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  renameFailedMessage,
  renamingMessage,
  useRenamePlanStore,
} from "../stores/useRenamePlanStore"
import type { NavigationState } from "../types/navigationState"
import { PlanNameForm } from "./planNameForm"

// The Rename form on the plan page (feature 011 spec User Story 4, FR-014, FR-020), with the shared plan name
// field, focus and Escape. onClose returns focus to the Rename button. When the session ended, the user logs in
// again and comes back to this plan.
export function RenamePlanForm({
  planId,
  onClose,
}: {
  planId: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const status = useRenamePlanStore((state) => state.status)
  const name = useRenamePlanStore((state) => state.name)
  const nameError = useRenamePlanStore((state) => state.nameError)
  const nameRefusals = useRenamePlanStore((state) => state.nameRefusals)
  const store = useRenamePlanStore.getState()

  useEffect(() => {
    if (status === "sessionExpired") {
      useCurrentUserStore.getState().markSessionEnded()
      const state: NavigationState = { loginReason: "expired" }
      navigate(`/login?returnTo=${encodeURIComponent(`/plans/${planId}`)}`, {
        state,
      })
    }
  }, [status, planId, navigate])

  function cancel() {
    store.cancel()
    onClose()
  }

  return (
    <PlanNameForm
      formLabel="Rename plan"
      submitLabel="Save"
      name={name}
      nameError={nameError}
      nameRefusals={nameRefusals}
      opened={status === "open"}
      busy={status === "saving"}
      onNameChange={store.setName}
      onSubmit={() => void store.submit(planId)}
      onCancel={cancel}
    >
      <RenameStatus status={status} />
    </PlanNameForm>
  )
}

function RenameStatus({
  status,
}: {
  status: ReturnType<typeof useRenamePlanStore.getState>["status"]
}) {
  if (status === "saving") {
    return <p role="status">{renamingMessage}</p>
  }

  if (status === "notFound") {
    return <p role="alert">This plan no longer exists.</p>
  }

  if (status === "serverError") {
    return (
      <p role="alert">
        {renameFailedMessage}{" "}
        <button
          type="button"
          onClick={() => void useRenamePlanStore.getState().retry()}
        >
          Retry
        </button>
      </p>
    )
  }

  return null
}
