import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"

// Clears the plan in progress in this tab: the setup, the activities and a schedule kept through Log in. Used
// when an edit is cancelled or belongs to another account (feature 011 spec FR-008, research section 10).
export function discardPlanInProgress(): void {
  usePlanSetupStore.getState().clear()
  usePlanActivitiesStore.getState().clear()
  useKeptScheduleStore.getState().clear()
}
