import { useEffect } from "react"
import { PlanProgress } from "../components/planProgress"
import { PlanSetupForm } from "../components/planSetupForm"
import { RecheckNotice } from "../components/recheckNotice"
import { usePageTitle } from "../hooks/usePageTitle"
import { useLocationSearchStore } from "../stores/useLocationSearchStore"
import { usePlanPeriodStore } from "../stores/usePlanPeriodStore"
import { usePlanSetupCheckStore } from "../stores/usePlanSetupCheckStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Step 1 of a plan: the location and the dates, then Continue. What the user enters stays in
// usePlanSetupStore when the page closes; the search, the date limits and the check do not.
export function PlanSetupPage() {
  usePageTitle("Plan setup")
  const recheckNotice = usePlanSetupStore((state) => state.recheckNotice)

  useEffect(() => {
    // The date limits come only from the server (spec FR-010); the dates field waits for them.
    void usePlanPeriodStore.getState().load()
    return () => {
      useLocationSearchStore.getState().reset()
      usePlanPeriodStore.getState().reset()
      usePlanSetupCheckStore.getState().reset()
    }
  }, [])

  return (
    <>
      <h1>Plan setup</h1>
      <PlanProgress current={1} />
      {recheckNotice && (
        <RecheckNotice>
          Your plan setup needs to be checked again. Select Continue.
        </RecheckNotice>
      )}
      <PlanSetupForm />
    </>
  )
}
