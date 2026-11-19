import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { discardPlanInProgress } from "../helpers/discardPlanInProgress"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import type { NavigationState } from "../types/navigationState"

// Shown on every planning step while a saved plan is being edited (feature 011 spec FR-008): which plan, that it
// is not changed until saved, and Cancel editing, which discards the changes and opens the saved plan. When
// another account is signed in, for example after a session ended, the edit and the plan in progress are
// discarded, so that account cannot save over this one's plan (research section 10).
export function EditingNotice() {
  const navigate = useNavigate()
  const edit = usePlanEditStore((state) => state.edit)
  const user = useCurrentUserStore((state) => state.user)
  const otherAccount =
    edit !== null && user !== null && user.email !== edit.ownerEmail

  useEffect(() => {
    if (otherAccount) {
      discardPlanInProgress()
      usePlanEditStore.getState().clearAll()
    }
  }, [otherAccount])

  if (!edit || otherAccount) {
    return null
  }

  // The plan page clears the plan in progress once it opens. Clearing it here would make this step send the
  // user back to an earlier step, and that redirect would win over the navigation.
  function cancelEditing() {
    const state: NavigationState = { discardPlanInProgress: true }
    navigate(`/plans/${edit!.planId}`, { state })
    usePlanEditStore.getState().clear()
  }

  return (
    <div className="recheck-notice editing-notice">
      <p>{`Editing '${edit.planName}'. Your saved plan is not changed until you save.`}</p>
      <p>
        <button type="button" onClick={cancelEditing}>
          Cancel editing
        </button>
      </p>
    </div>
  )
}
