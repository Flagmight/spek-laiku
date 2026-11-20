import type { MouseEvent } from "react"
import {
  checkingText,
  noProblemsText,
  planCheckSummaryText,
  planProblemItemText,
  planProblems,
  scheduledEntryId,
} from "../helpers/planProblemText"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import type { PlanCheck } from "../types/planCheck"

// The "Plan check" region above the saved plan's schedule (feature 012 spec FR-008, FR-009, FR-018): the loading
// message, then either the no-problem message or the summary with every problem. Messages are announced without
// moving focus; each problem links to its schedule entry. checked is the result of checking the schedule that is
// shown, or null; a result for another version of the plan is never shown (research section 12).
export function PlanCheckSection({ checked }: { checked: PlanCheck | null }) {
  const status = usePlanCheckStore((state) => state.status)
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
