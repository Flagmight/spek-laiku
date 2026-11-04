import { formatPlanDate } from "../helpers/formatPlanDate"
import { locationLabel } from "../stores/usePlanSetupStore"
import type { CheckedPlanSetup } from "../types/planSetup"

// One line with what step 1 decided, for example
// "Kaunas, Kaunas County · Sat 7 Nov 2026, Sun 8 Nov 2026 · Maximum travel distance: 30 km".
export function PlanSetupSummary({ setup }: { setup: CheckedPlanSetup }) {
  return (
    <p className="plan-setup-summary">
      {locationLabel(setup.location)} ·{" "}
      {setup.dates.map(formatPlanDate).join(", ")} · Maximum travel distance:{" "}
      {setup.maxTravelDistanceKm} km
    </p>
  )
}
