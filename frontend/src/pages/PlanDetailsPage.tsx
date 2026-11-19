import { useEffect } from "react"
import { Link, useLocation, useNavigate, useParams } from "react-router-dom"
import { PlanDetailsActions } from "../components/planDetailsActions"
import { SavedPlanView } from "../components/savedPlanView"
import { discardPlanInProgress } from "../helpers/discardPlanInProgress"
import { usePageTitle } from "../hooks/usePageTitle"
import {
  planDuplicatedMessage,
  usePlanActionsStore,
} from "../stores/usePlanActionsStore"
import {
  planRenamedMessage,
  useRenamePlanStore,
} from "../stores/useRenamePlanStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import type { SavedPlanStatus } from "../stores/useSavedPlanStore"
import type { NavigationState } from "../types/navigationState"
import type { SavedPlanSummary } from "../types/savedPlan"
import { AccessDeniedPage } from "./AccessDeniedPage"

// The tab title until the plan's own name is known.
const titles: Record<SavedPlanStatus, string> = {
  loading: "Saved plan",
  loaded: "Saved plan",
  notFound: "Plan not found",
  forbidden: "Access denied",
  serverError: "Saved plan",
}

// One saved plan, exactly as it was saved, in the Schedule Overview's layout (feature 010 spec User Story 4,
// FR-010), with its actions (feature 011 spec FR-019). Renaming shows "✓ Success: Plan renamed.", deleting it
// opens My plans with "Plan deleted.", and duplicating it opens the copy with "Plan duplicated.". Recalculating
// comes with feature 012. Opening it never generates a schedule or calls the weather or map data services.
export function PlanDetailsPage() {
  const { planId = "" } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const status = useSavedPlanStore((state) => state.status)
  const plan = useSavedPlanStore((state) => state.plan)
  const renameStatus = useRenamePlanStore((state) => state.status)
  // The title follows a rename, because it reads the loaded plan's name (feature 011 FR-014).
  usePageTitle(status === "loaded" && plan ? plan.name : titles[status])

  useEffect(() => {
    const store = useSavedPlanStore.getState()
    void store.load(planId)
    const arrival = location.state as NavigationState | null
    // A duplicate on the previous plan page brings the user to the copy with its notice (research section 12).
    if (arrival?.planNotice === "duplicated") {
      usePlanActionsStore.getState().showNotice(planDuplicatedMessage)
    }
    // Cancel editing brings the user here; the changes are discarded now that no planning step is shown.
    if (arrival?.discardPlanInProgress) {
      discardPlanInProgress()
    }
    if (arrival?.planNotice || arrival?.discardPlanInProgress) {
      navigate(location.pathname, { replace: true, state: null })
    }
    return () => {
      store.reset()
      usePlanActionsStore.getState().reset()
    }
  }, [planId]) // eslint-disable-line react-hooks/exhaustive-deps

  function openMyPlansAfterDelete() {
    const state: NavigationState = { planNotice: "deleted" }
    navigate("/plans", { state })
  }

  function openCopy(copy: SavedPlanSummary) {
    const state: NavigationState = { planNotice: "duplicated" }
    navigate(`/plans/${copy.id}`, { state })
  }

  if (status === "forbidden") {
    return <AccessDeniedPage />
  }

  if (status === "notFound") {
    return (
      <>
        <h1>Plan not found</h1>
        <p>This plan no longer exists.</p>
        <p>
          <Link to="/">Go to the home page</Link>
        </p>
        <p>
          <Link to="/plans">Go to My plans</Link>
        </p>
      </>
    )
  }

  if (status === "loaded" && plan) {
    return (
      <SavedPlanView
        plan={plan}
        notice={renameStatus === "renamed" ? planRenamedMessage : null}
        actions={
          <PlanDetailsActions
            plan={plan}
            onDeleted={openMyPlansAfterDelete}
            onDuplicated={openCopy}
          />
        }
      />
    )
  }

  return (
    <>
      <h1>Saved plan</h1>
      {status === "serverError" ? (
        <p role="alert">
          Error: Plan could not be loaded.{" "}
          <button
            type="button"
            onClick={() => void useSavedPlanStore.getState().retry()}
          >
            Retry
          </button>
        </p>
      ) : (
        <p role="status">Loading your plan…</p>
      )}
    </>
  )
}
