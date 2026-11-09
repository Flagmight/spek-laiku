import { useState } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanCategoriesStore } from "../stores/usePlanCategoriesStore"
import type { PlanCategory } from "../types/planActivity"

// The categories to pick from (spec FR-003 to FR-006). The limit comes only from the server, so the
// browser holds no copy of it (constitution I).
export function PlanCategoryList() {
  const status = usePlanCategoriesStore((state) => state.status)
  const categories = usePlanCategoriesStore((state) => state.categories)
  const maxActivities = usePlanCategoriesStore((state) => state.maxActivities)
  const activityCount = usePlanActivitiesStore(
    (state) => state.activities.length,
  )
  const [addedMessage, setAddedMessage] = useState("")
  const atLimit = maxActivities !== null && activityCount >= maxActivities

  function add(category: PlanCategory) {
    usePlanActivitiesStore.getState().add(category)
    const { activities } = usePlanActivitiesStore.getState()
    const added = activities[activities.length - 1]
    setAddedMessage(`${planActivityNames(activities)[added.id]} added.`)
  }

  return (
    <section aria-labelledby="plan-categories-heading">
      <h2 id="plan-categories-heading" tabIndex={-1}>
        Activity categories
      </h2>
      {/* Always rendered, so screen readers announce the text when it appears. */}
      <p role="status" className="loading-status">
        {status === "loading" ? "Loading activity categories…" : ""}
      </p>
      {status === "error" && (
        <div className="server-error">
          <p role="alert">
            {formatErrorMessage("Activity categories could not be loaded.")}
          </p>
          <button
            type="button"
            onClick={() => void usePlanCategoriesStore.getState().load()}
          >
            Retry
          </button>
        </div>
      )}
      {status === "loaded" && categories.length === 0 && (
        <p>No activity categories are available yet.</p>
      )}
      {categories.length > 0 && (
        <ul className="plan-category-list">
          {categories.map((category) => (
            <li key={category.id}>
              <span>{category.name}</span>
              <span>{category.type}</span>
              <span>{`${category.defaultDurationHours} h`}</span>
              <button
                type="button"
                aria-label={`Add ${category.name}`}
                disabled={atLimit}
                onClick={() => add(category)}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {atLimit && <p>{`You can add up to ${maxActivities} activities.`}</p>}
      <p role="status" className="loading-status">
        {addedMessage}
      </p>
    </section>
  )
}
