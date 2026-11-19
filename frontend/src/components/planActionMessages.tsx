import {
  pendingMessage,
  planGoneMessage,
  usePlanActionsStore,
} from "../stores/usePlanActionsStore"

// The status region for plan actions on My plans and the plan page (feature 011 spec FR-003, FR-020): the
// pending text, then the notice ("Plan deleted."). It is always rendered, so screen readers announce changes
// without focus moving. An error is shown with Retry, except for a plan that no longer exists.
export function PlanActionMessages() {
  const pending = usePlanActionsStore((state) => state.pending)
  const notice = usePlanActionsStore((state) => state.notice)
  const error = usePlanActionsStore((state) => state.error)

  return (
    <>
      <p role="status">{pendingMessage(pending) ?? notice}</p>
      {error && (
        <p role="alert">
          {error.message}
          {error.message !== planGoneMessage && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => void usePlanActionsStore.getState().retry()}
              >
                Retry
              </button>
            </>
          )}
        </p>
      )}
    </>
  )
}
