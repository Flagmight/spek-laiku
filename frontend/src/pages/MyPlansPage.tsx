import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { PlanActionMessages } from "../components/planActionMessages"
import { PlanActions } from "../components/planActions"
import { SavedPlanList } from "../components/savedPlanList"
import { usePageTitle } from "../hooks/usePageTitle"
import {
  planDeletedMessage,
  usePlanActionsStore,
} from "../stores/usePlanActionsStore"
import { useSavedPlansStore } from "../stores/useSavedPlansStore"
import type { NavigationState } from "../types/navigationState"
import type { SavedPlanSummary } from "../types/savedPlan"

// Where focus goes after a delete: the next plan's Open link, or the heading when no plan follows.
type FocusTarget = { planId: string } | "heading" | null

// The signed-in user's saved plans, newest saved first (feature 010 spec User Story 3, FR-009), with Duplicate
// and Delete on each plan (feature 011 spec User Stories 1 and 2). Messages about the actions are shown in one
// status region under the heading.
export function MyPlansPage() {
  usePageTitle("My plans")
  const location = useLocation()
  const navigate = useNavigate()
  const status = useSavedPlansStore((state) => state.status)
  const plans = useSavedPlansStore((state) => state.plans)
  const heading = useRef<HTMLHeadingElement>(null)
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null)

  useEffect(() => {
    const store = useSavedPlansStore.getState()
    void store.load()
    // A delete on the plan page brings the user here with its notice (research section 12).
    if ((location.state as NavigationState | null)?.planNotice === "deleted") {
      usePlanActionsStore.getState().showNotice(planDeletedMessage)
      navigate(location.pathname, { replace: true, state: null })
    }
    return () => {
      store.reset()
      usePlanActionsStore.getState().reset()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focusTarget === "heading") {
      heading.current?.focus()
    } else if (focusTarget) {
      document
        .querySelector<HTMLElement>(`a[href="/plans/${focusTarget.planId}"]`)
        ?.focus()
    }
  }, [focusTarget])

  function removeAndFocus(planId: string) {
    const index = plans.findIndex((plan) => plan.id === planId)
    const next = plans[index + 1]
    useSavedPlansStore.getState().remove(planId)
    setFocusTarget(next ? { planId: next.id } : "heading")
  }

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        My plans
      </h1>
      <PlanActionMessages />
      <MyPlansBody
        status={status}
        plans={plans}
        actions={(plan) => (
          <PlanActions
            plan={plan}
            onDeleted={removeAndFocus}
            onGone={removeAndFocus}
          />
        )}
      />
    </>
  )
}

function MyPlansBody({
  status,
  plans,
  actions,
}: Pick<ReturnType<typeof useSavedPlansStore.getState>, "status" | "plans"> & {
  actions: (plan: SavedPlanSummary) => ReactNode
}) {
  if (status === "loading") {
    return (
      <div role="status">
        <p>Loading your plans…</p>
        <ul className="placeholder-rows" aria-hidden="true">
          <li />
          <li />
          <li />
        </ul>
      </div>
    )
  }

  if (status === "serverError") {
    return (
      <p role="alert">
        Error: Saved plans could not be loaded.{" "}
        <button
          type="button"
          onClick={() => void useSavedPlansStore.getState().retry()}
        >
          Retry
        </button>
      </p>
    )
  }

  if (plans.length === 0) {
    return (
      <>
        <p>No saved plans yet.</p>
        <p>
          <Link to="/plan/setup" className="button-link">
            New plan
          </Link>
        </p>
      </>
    )
  }

  return (
    <SavedPlanList plans={plans} caption="Your saved plans" actions={actions} />
  )
}
