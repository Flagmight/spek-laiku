import {
  initialPlanActivitiesState,
  usePlanActivitiesStore,
} from "../stores/usePlanActivitiesStore"
import {
  initialPlanSetupState,
  locationLabel,
  usePlanSetupStore,
} from "../stores/usePlanSetupStore"
import type { PlanActivity } from "../types/planActivity"
import type { SavedPlan, SavedPlanActivity } from "../types/savedPlan"

// The server sends null for an Indoor activity's limits, which become empty fields.
function limitText(value: number | null): string {
  return value === null ? "" : String(value)
}

function activityFrom(saved: SavedPlanActivity): PlanActivity {
  return {
    id: crypto.randomUUID(),
    categoryId: saved.categoryId,
    name: saved.name,
    type: saved.type,
    durationText: String(saved.durationHours),
    requiresDaylight: saved.requiresDaylight,
    maxWindText: limitText(saved.maxWindMs),
    maxRainText: limitText(saved.maxRainMmPerHour),
    minTemperatureText: limitText(saved.minTemperatureC),
    maxTemperatureText: limitText(saved.maxTemperatureC),
  }
}

// Fills the plan in progress with a saved plan, for "Edit plan" (feature 011 spec FR-007, data-model.md "Filling
// the plan in progress from a saved plan"). Nothing is marked as checked: every planning step checks its values
// again on Continue, exactly as for a new plan (FR-008), so passed dates and changed categories are caught.
export function fillPlanFromSavedPlan(plan: SavedPlan): void {
  usePlanSetupStore.setState({
    ...initialPlanSetupState,
    location: plan.location,
    locationText: locationLabel(plan.location),
    dates: [...plan.dates],
    maxTravelDistanceText: String(plan.maxTravelDistanceKm),
  })
  usePlanActivitiesStore.setState({
    ...initialPlanActivitiesState,
    activities: plan.activities.map(activityFrom),
  })
}
