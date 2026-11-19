import { useEffect } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { PlanActionMessages } from "../components/planActionMessages"
import { PlanActions } from "../components/planActions"
import { SavedPlanView } from "../components/savedPlanView"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActionsStore } from "../stores/usePlanActionsStore"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import type { SavedPlanStatus } from "../stores/useSavedPlanStore"
import type { NavigationState } from "../types/navigationState"
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
// FR-010), with its actions (feature 011 spec FR-019). Deleting it opens My plans with "Plan deleted.".
// Recalculating comes with feature 012. Opening it never generates a schedule or calls the weather or map data
// services.
export function PlanDetailsPage() {
  const { planId = "" } = useParams()
  const navigate = useNavigate()
  const status = useSavedPlanStore((state) => state.status)
  const plan = useSavedPlanStore((state) => state.plan)
  usePageTitle(status === "loaded" && plan ? plan.name : titles[status])

  useEffect(() => {
    const store = useSavedPlanStore.getState()
    void store.load(planId)
    return () => {
      store.reset()
      usePlanActionsStore.getState().reset()
    }
  }, [planId])

  function openMyPlansAfterDelete() {
    const state: NavigationState = { planNotice: "deleted" }
    navigate("/plans", { state })
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
        actions={
          <>
            <p className="plan-actions">
              <PlanActions plan={plan} onDeleted={openMyPlansAfterDelete} />
            </p>
            <PlanActionMessages />
          </>
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
