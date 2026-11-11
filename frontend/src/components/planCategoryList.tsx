import { useState } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { planActivityNames } from "../helpers/planActivityNames"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanCategoriesStore } from "../stores/usePlanCategoriesStore"
import type { PlanCategory } from "../types/planActivity"

// The button that opens and closes the list; focus moves here when the last activity is removed.
export const categoriesToggleId = "plan-categories-toggle"
const headingId = "plan-categories-heading"
const panelId = "plan-categories-panel"
const searchId = "plan-categories-search"
// From this many categories on, a search field helps find one (spec FR-023). A display choice, not a
// business rule, so it lives in the browser.
const searchFrom = 9

function matches(category: PlanCategory, search: string) {
  return category.name
    .toLocaleLowerCase()
    .includes(search.trim().toLocaleLowerCase())
}

// The categories to pick from (spec FR-003 to FR-006, FR-023), in a list that opens and closes. The
// limit comes only from the server, so the browser holds no copy of it (constitution I).
export function PlanCategoryList() {
  const status = usePlanCategoriesStore((state) => state.status)
  const categories = usePlanCategoriesStore((state) => state.categories)
  const maxActivities = usePlanCategoriesStore((state) => state.maxActivities)
  const activityCount = usePlanActivitiesStore(
    (state) => state.activities.length,
  )
  const [added, setAdded] = useState({ message: "", activityCount: 0 })
  const [open, setOpen] = useState(activityCount === 0)
  const [search, setSearch] = useState("")
  // Opens the list again when the last activity is removed, while the page renders (no effect needed).
  const [seenCount, setSeenCount] = useState(activityCount)
  if (seenCount !== activityCount) {
    setSeenCount(activityCount)
    if (activityCount === 0) {
      setOpen(true)
    }
  }

  const atLimit = maxActivities !== null && activityCount >= maxActivities
  const showSearch = categories.length >= searchFrom
  const shown = showSearch
    ? categories.filter((category) => matches(category, search))
    : categories

  function add(category: PlanCategory) {
    usePlanActivitiesStore.getState().add(category)
    const { activities } = usePlanActivitiesStore.getState()
    const newest = activities[activities.length - 1]
    setAdded({
      message: `${planActivityNames(activities)[newest.id]} added.`,
      activityCount: activities.length,
    })
    // Every Add is about to be disabled, which would leave keyboard focus nowhere.
    if (maxActivities !== null && activities.length >= maxActivities) {
      document.getElementById(categoriesToggleId)?.focus()
    }
  }

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="disclosure-heading">
        <button
          id={categoriesToggleId}
          type="button"
          className="disclosure-toggle"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          Activity categories
          <span className="disclosure-icon" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
        </button>
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
      <div id={panelId} hidden={!open}>
        {showSearch && (
          <div className="form-field category-search">
            <label htmlFor={searchId}>Search activities</label>
            <input
              id={searchId}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        )}
        {showSearch && shown.length === 0 && (
          <p>No activities match your search.</p>
        )}
        {shown.length > 0 && (
          <ul className="category-list">
            {shown.map((category) => (
              <li key={category.id}>
                <span className="category-name">{category.name}</span>
                <span className="category-type">{category.type}</span>
                <span className="category-type">{`${category.defaultDurationHours} h`}</span>
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
      </div>
      {atLimit && <p>{`You can add up to ${maxActivities} activities.`}</p>}
      {/* Empty again after a Remove: a live region is read out only when its text changes. */}
      <p role="status" className="loading-status">
        {added.activityCount === activityCount ? added.message : ""}
      </p>
    </section>
  )
}
