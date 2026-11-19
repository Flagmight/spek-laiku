import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import { checkedPlanRequest } from "./checkedPlanRequest"

// A key for a checked setup and activities: equal keys mean the same plan. Used for the schedule kept through
// Log in (feature 010 research section 8) and for the saved marker (feature 011 research section 10).
export function planKey(
  setup: CheckedPlanSetup,
  activities: CheckedPlanActivity[],
): string {
  return JSON.stringify(checkedPlanRequest(setup, activities))
}
