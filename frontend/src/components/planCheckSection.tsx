import type { MouseEvent } from "react"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import {
  checkingText,
  noProblemsText,
  planCheckSummaryText,
  planProblemItemText,
  planProblems,
  scheduledEntryId,
} from "../helpers/planProblemText"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import type { PlanCheckStatus } from "../stores/usePlanCheckStore"
import type { PlanCheck } from "../types/planCheck"

// The error of a check that has no result (spec FR-013, FR-015). The saved plan stays on screen as saved.
const errorTexts: Partial<Record<PlanCheckStatus, string>> = {
  weatherUnavailable:
    "The forecast could not be updated. Your saved plan is unchanged.",
  serverError: "Something went wrong. Try again.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
}

// The "Plan check" region above the saved plan's schedule (feature 012 spec FR-008, FR-009, FR-013, FR-018): the
// loading message, then either the no-problem message, the summary with every problem, or an error with Retry.
// Messages are announced without moving focus; each problem links to its schedule entry. checked is the result
// of checking the schedule that is shown, or null; a result for another version of the plan is never shown
// (research section 12).
export function PlanCheckSection({ checked }: { checked: PlanCheck | null }) {
  const status = usePlanCheckStore((state) => state.status)
  const error = errorTexts[status]
  const problems = checked ? planProblems(checked.entries) : []

  let message = ""
  if (status === "checking") {
    message = checkingText
  } else if (checked) {
    message =
      problems.length === 0
        ? noProblemsText
        : planCheckSummaryText(checked.entries)
  }

  function focusEntry(event: MouseEvent<HTMLAnchorElement>, index: number) {
    event.preventDefault()
    document.getElementById(scheduledEntryId(index))?.focus()
  }

  return (
    <section aria-labelledby="plan-check-heading" className="plan-check">
      <h2 id="plan-check-heading">Plan check</h2>
      <p role="status">{message}</p>
      {error && (
        <div className="server-error">
          <p role="alert">{formatErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => void usePlanCheckStore.getState().retry()}
          >
            Retry
          </button>
        </div>
      )}
      {problems.length > 0 && (
        <ul className="plan-problems">
          {problems.map(({ index, entry, problem }, position) => (
            <li key={`${index}-${problem.rule}-${position}`}>
              <a
                href={`#${scheduledEntryId(index)}`}
                onClick={(event) => focusEntry(event, index)}
              >
                {planProblemItemText(entry, problem)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
