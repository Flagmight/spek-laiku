import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { planKey } from "./planKey"

// Whether the tab holds a plan that starting an edit would replace without it being saved (feature 011 spec
// FR-013, research section 10): any edit in progress, or a plan with a location, a date or an activity that has
// changed since its last successful Save plan or Save changes. An edit of the same plan counts too: starting it
// again reloads the saved plan and drops the unsaved changes, so it is confirmed first.
export function hasPlanInProgress(): boolean {
  const { edit, savedPlanKey } = usePlanEditStore.getState()
  if (edit) {
    return true
  }

  const setup = usePlanSetupStore.getState()
  const activities = usePlanActivitiesStore.getState()
  if (
    setup.checked &&
    activities.checked &&
    planKey(setup.checked, activities.checked) === savedPlanKey
  ) {
    return false
  }

  return (
    setup.location !== null ||
    setup.dates.length > 0 ||
    activities.activities.length > 0
  )
}
