import { useEffect } from "react"
import { Link, Navigate, useLocation } from "react-router-dom"
import { PlanActivitiesForm } from "../components/planActivitiesForm"
import { PlanCategoryList } from "../components/planCategoryList"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupSummary } from "../components/planSetupSummary"
import { RecheckNotice } from "../components/recheckNotice"
import { usePageTitle } from "../hooks/usePageTitle"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanCategoriesStore } from "../stores/usePlanCategoriesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { NavigationState } from "../types/navigationState"

// Step 2 of a plan (spec FR-003 to FR-010, FR-020): the setup the server accepted, the categories to
// pick from and the plan's activities. Without a checked setup, for example after a change on Plan
// setup, the user goes back to step 1. The activities stay in their store when the page closes.
export function ActivitySelectionPage() {
  usePageTitle("Activity selection")
  const checked = usePlanSetupStore((state) => state.checked)
  const recheckNotice = usePlanActivitiesStore((state) => state.recheckNotice)
  const hasCheckedSetup = checked !== null

  const focusActivityId = (useLocation().state as NavigationState | null)
    ?.focusActivityId

  useEffect(() => {
    if (!hasCheckedSetup) {
      return
    }

    const categories = usePlanCategoriesStore.getState()
    void categories.load()
    return () => categories.reset()
  }, [hasCheckedSetup])

  // "Change activity" on step 3 opens this page on that activity (feature 007 FR-021). The activities are
  // rendered from their store at once, so the heading is there after the first render; the effect runs
  // once per arrival, and an unknown id finds nothing.
  useEffect(() => {
    if (focusActivityId) {
      document.getElementById(`activity-${focusActivityId}-heading`)?.focus()
    }
  }, [focusActivityId])

  if (!checked) {
    return <Navigate to="/plan/setup" replace />
  }

  return (
    <>
      <h1>Activity selection</h1>
      <PlanProgress current={2} />
      {recheckNotice && (
        <RecheckNotice>
          Your activities need to be checked again. Select Continue.
        </RecheckNotice>
      )}
      <PlanSetupSummary setup={checked} />
      <p>
        <Link to="/plan/setup" className="button-link">
          Back
        </Link>
      </p>
      <div className="activity-selection-layout">
        <PlanCategoryList />
        <PlanActivitiesForm />
      </div>
    </>
  )
}
