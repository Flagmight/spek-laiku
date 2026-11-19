import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import { formatPlanDates, formatSavedAt } from "../helpers/formatSavedAt"
import type { SavedPlanSummary } from "../types/savedPlan"

// Saved plans as one table, used by My plans and the Home block (feature 010 spec US3 scenario 6, US6). On
// wide screens it is a table with Open in the last column; on phones each row is a card titled with the plan
// name, with each value labelled and Open below, as the step 3 plan overview. Names are plain text (FR-017).
// My plans adds Duplicate and Delete after Open through actions (feature 011 FR-019); Home shows only Open.
export function SavedPlanList({
  plans,
  caption,
  actions,
}: {
  plans: SavedPlanSummary[]
  caption: string
  actions?: (plan: SavedPlanSummary) => ReactNode
}) {
  return (
    <table className="saved-plans">
      <caption className="visually-hidden">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Plan</th>
          <th scope="col">Location</th>
          <th scope="col">Dates</th>
          <th scope="col">Saved</th>
          <th scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {plans.map((plan) => (
          <tr key={plan.id}>
            <th scope="row">{plan.name}</th>
            <td>
              <span className="cell-label">Location: </span>
              {plan.locationName}
            </td>
            <td>
              <span className="cell-label">Dates: </span>
              {formatPlanDates(plan.dates)}
            </td>
            <td>{formatSavedAt(plan.savedAt)}</td>
            <td>
              <Link to={`/plans/${plan.id}`} aria-label={`Open ${plan.name}`}>
                Open
              </Link>
              {actions?.(plan)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
