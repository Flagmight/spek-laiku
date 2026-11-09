import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { PlanActivitySettings } from "./planActivitySettings"

// The plan's activities, each with its own settings (spec FR-007, FR-008).
export function PlanActivitiesForm() {
  const activities = usePlanActivitiesStore((state) => state.activities)
  const names = planActivityNames(activities)

  return (
    <section aria-labelledby="plan-activities-heading">
      <h2 id="plan-activities-heading">Your activities</h2>
      {activities.length === 0 && (
        <p>
          No activities added yet. Select at least one category to continue.
        </p>
      )}
      {activities.map((activity) => (
        <PlanActivitySettings
          key={activity.id}
          activity={activity}
          shownName={names[activity.id]}
          errors={{}}
        />
      ))}
    </section>
  )
}
