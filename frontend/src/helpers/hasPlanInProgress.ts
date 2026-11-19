import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { planKey } from "./planKey"

// Whether the tab holds a plan that starting an edit would replace without it being saved (feature 011 spec
// FR-013, research section 10): an edit of another plan, or a plan with a location, a date or an activity that
// has changed since its last successful Save plan or Save changes.
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
