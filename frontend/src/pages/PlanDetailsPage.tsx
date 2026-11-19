import { useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import { SavedPlanView } from "../components/savedPlanView"
import { usePageTitle } from "../hooks/usePageTitle"
import { useSavedPlanStore } from "../stores/useSavedPlanStore"
import type { SavedPlanStatus } from "../stores/useSavedPlanStore"
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
// FR-010). Read-only: editing and recalculating come with features 011 and 012. Opening it never generates a
// schedule or calls the weather or map data services.
export function PlanDetailsPage() {
  const { planId = "" } = useParams()
  const status = useSavedPlanStore((state) => state.status)
  const plan = useSavedPlanStore((state) => state.plan)
  usePageTitle(status === "loaded" && plan ? plan.name : titles[status])

  useEffect(() => {
    const store = useSavedPlanStore.getState()
    void store.load(planId)
    return () => store.reset()
  }, [planId])

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
    return <SavedPlanView plan={plan} />
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
