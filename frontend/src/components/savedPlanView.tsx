import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  formatPlanDates,
  formatSavedAt,
  formatSavedDate,
} from "../helpers/formatSavedAt"
import type { SavedPlan } from "../types/savedPlan"
import { ScheduleView } from "./scheduleView"

// One saved plan exactly as it was saved, in the Schedule Overview's layout (feature 010 spec User Story 4,
// FR-010). Feature 011 adds the plan's actions below the heading and a status notice for "Plan duplicated."
// and similar messages. Opening it never generates a schedule or calls the weather or map data services.
export function SavedPlanView({
  plan,
  actions,
  notice,
}: {
  plan: SavedPlan
  actions?: ReactNode
  notice?: string | null
}) {
  const { scheduled, unscheduled, travel } = plan

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumbs">
        <ol>
          <li>
            <Link to="/">Home</Link>
          </li>
          <li>
            <Link to="/plans">My plans</Link>
          </li>
          <li aria-current="page">{plan.name}</li>
        </ol>
      </nav>
      <h1>{plan.name}</h1>
      {notice && <p role="status">{notice}</p>}
      {actions}
      <dl className="saved-plan-setup">
        <dt>Location</dt>
        <dd>{`${plan.location.name}, ${plan.location.area}`}</dd>
        <dt>Dates</dt>
        <dd>{formatPlanDates(plan.dates)}</dd>
        <dt>Maximum travel distance</dt>
        <dd>{`${plan.maxTravelDistanceKm} km`}</dd>
      </dl>
      <p>{formatSavedAt(plan.savedAt)}</p>
      <p>
        {`This is your plan as saved on ${formatSavedDate(plan.savedAt)}. The forecast may have changed since.`}
      </p>
      <ScheduleView
        schedule={{ generatedScheduleId: null, scheduled, unscheduled, travel }}
      />
    </>
  )
}
