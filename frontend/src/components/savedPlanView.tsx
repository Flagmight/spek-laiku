import type { ReactNode } from "react"
import { Link } from "react-router-dom"
import {
  formatPlanDates,
  formatSavedAt,
  formatSavedDate,
} from "../helpers/formatSavedAt"
import { checkedNoteText } from "../helpers/planProblemText"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import type { SavedPlan } from "../types/savedPlan"
import { PlanCheckSection } from "./planCheckSection"
import { ScheduleView } from "./scheduleView"

// One saved plan in the Schedule Overview's layout (feature 010 spec User Story 4, FR-010). Feature 011 adds the
// plan's actions below the heading and a status notice for "Plan duplicated." and similar messages. Feature 012
// adds the "Plan check" region: once the plan has been checked against the latest forecast, the schedule shows
// the latest weather and the problems, and the note says when the forecast was received. The plan itself is
// still shown exactly as saved; until a check succeeds, the note says it is the plan as saved. Activities that
// have started are marked "Already past. Not checked.", also when the whole plan is past.
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
  const checkStatus = usePlanCheckStore((state) => state.status)
  const result = usePlanCheckStore((state) => state.result)
  // Only a check of this very schedule is shown on it (research section 12).
  const current =
    result !== null &&
    result.savedAt === plan.savedAt &&
    result.entries.length === scheduled.length
      ? result
      : null
  // A check against a forecast: the note says when that forecast was received.
  const checked =
    checkStatus === "checked" && current?.forecastUpdatedAt ? current : null
  // Every activity has started: the entries are marked past, and the note still says this is the plan as saved,
  // because no forecast was used (spec User Story 5).
  const shown = checked ?? (checkStatus === "allPast" ? current : null)

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
        {checked?.forecastUpdatedAt
          ? checkedNoteText(checked.forecastUpdatedAt)
          : `This is your plan as saved on ${formatSavedDate(plan.savedAt)}. The forecast may have changed since.`}
      </p>
      <PlanCheckSection checked={shown} />
      <ScheduleView
        schedule={{ generatedScheduleId: null, scheduled, unscheduled, travel }}
        checks={shown?.entries}
      />
    </>
  )
}
