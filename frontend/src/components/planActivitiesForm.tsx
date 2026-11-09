import { useState } from "react"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { PlanActivitySettings } from "./planActivitySettings"

// The plan's activities, each with its own settings (spec FR-007 to FR-009).
export function PlanActivitiesForm() {
  const activities = usePlanActivitiesStore((state) => state.activities)
  const [removed, setRemoved] = useState({ message: "", activityCount: 0 })
  const names = planActivityNames(activities)

  function remove(id: string) {
    const index = activities.findIndex((activity) => activity.id === id)
    const neighbour = activities[index + 1] ?? activities[index - 1]
    usePlanActivitiesStore.getState().remove(id)
    setRemoved({
      message: `${names[id]} removed.`,
      activityCount: activities.length - 1,
    })
    // Both targets stay on the page while the removed activity goes, so focus can move straight away.
    document
      .getElementById(
        neighbour
          ? `activity-${neighbour.id}-heading`
          : "plan-categories-heading",
      )
      ?.focus()
  }

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
          onRemove={() => remove(activity.id)}
        />
      ))}
      {/* Empty again after the next Add: a live region is read out only when its text changes. */}
      <p role="status" className="loading-status">
        {removed.activityCount === activities.length ? removed.message : ""}
      </p>
    </section>
  )
}
