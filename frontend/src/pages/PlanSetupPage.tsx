import { useEffect } from "react"
import { LocationSearchField } from "../components/locationSearchField"
import { PlanProgress } from "../components/planProgress"
import { usePageTitle } from "../hooks/usePageTitle"
import { useLocationSearchStore } from "../stores/useLocationSearchStore"
import { usePlanPeriodStore } from "../stores/usePlanPeriodStore"

// Step 1 of a plan: the location (and, in later phases, the dates and distance). What the user
// enters stays in usePlanSetupStore when the page closes; the search and the date limits do not.
export function PlanSetupPage() {
  usePageTitle("Plan setup")

  useEffect(() => {
    // The date limits come only from the server (spec FR-010); the dates field uses them.
    void usePlanPeriodStore.getState().load()
    return () => {
      useLocationSearchStore.getState().reset()
      usePlanPeriodStore.getState().reset()
    }
  }, [])

  return (
    <>
      <h1>Plan setup</h1>
      <PlanProgress current={1} />
      <LocationSearchField />
    </>
  )
}
