import type { PlanCheckEntry, PlanProblem } from "../types/planCheck"
import { kmText } from "./placeText"

// The words of the plan check (feature 012 spec User Stories 1 and 3, FR-009, FR-011). The server has decided
// every rule, the worst value and its hour; this only words its answer. Numbers are written as the schedule's
// weather line writes them (9, 8.5), so "9.0" from the server reads "9" (research section 11). A trip
// distance is written as the schedule writes it, with one decimal place ("34.2 km", feature 009).

export const checkingText = "Checking your plan against the latest forecast…"

export const noProblemsText =
  "✓ No problems found. Your plan fits the current forecast."

// A plan whose scheduled activities have all started (spec User Story 5).
export const allPastText =
  "This plan's dates have passed. It is not checked against the forecast."

// The reason of one broken rule, word for word as in spec User Story 3.
export function planProblemText(problem: PlanProblem): string {
  const { time, value, limit } = problem
  switch (problem.rule) {
    case "wind":
      return `Wind up to ${value} m/s at ${time}, more than your limit of ${limit} m/s.`
    case "rain":
      return `Rain up to ${value} mm/h at ${time}, more than your limit of ${limit} mm/h.`
    case "cold":
      return `Temperature down to ${value} °C at ${time}, below your minimum of ${limit} °C.`
    case "heat":
      return `Temperature up to ${value} °C at ${time}, above your maximum of ${limit} °C.`
    case "noForecast":
      return `No forecast for ${time}.`
    case "beforeSunrise":
      return `Starts at ${time}, before sunrise at ${problem.sunTime}.`
    case "afterSunset":
      return `Ends at ${time}, after sunset at ${problem.sunTime}.`
    case "overlap":
      return `Overlaps with ${problem.otherActivityName} (${problem.otherStartTime}–${problem.otherEndTime}).`
    case "travel":
      return `Travel of ${kmText(value ?? 0)} from ${problem.fromPlaceName}, more than your ${limit} km limit.`
    default: {
      const unknown: never = problem.rule
      return unknown
    }
  }
}

// One problem as the "Plan check" list shows it: the activity, its date and time, and the reason.
export function planProblemItemText(
  entry: PlanCheckEntry,
  problem: PlanProblem,
): string {
  return `${entry.activityName}, ${entry.date} ${entry.startTime}–${entry.endTime}: ${planProblemText(problem)}`
}

// Every problem with its entry and the entry's position in the schedule, in the order the server sends the
// entries (date, then start time) and, within an entry, the order of its problems (spec FR-009).
export function planProblems(
  entries: PlanCheckEntry[],
): { index: number; entry: PlanCheckEntry; problem: PlanProblem }[] {
  return entries.flatMap((entry, index) =>
    entry.problems.map((problem) => ({ index, entry, problem })),
  )
}

// "<n> problem(s) in <m> of <k> scheduled activities.", where k counts only the activities that were checked
// (spec FR-009).
export function planCheckSummaryText(entries: PlanCheckEntry[]): string {
  const checked = entries.filter((entry) => !entry.past)
  const problems = checked.reduce(
    (count, entry) => count + entry.problems.length,
    0,
  )
  const affected = checked.filter((entry) => entry.problems.length > 0).length
  const problemWord = problems === 1 ? "problem" : "problems"
  const activityWord = checked.length === 1 ? "activity" : "activities"
  return `${problems} ${problemWord} in ${affected} of ${checked.length} scheduled ${activityWord}.`
}

// The id of a schedule entry on the plan page, which a problem's link moves focus to (research section 14).
export function scheduledEntryId(index: number): string {
  return `scheduled-entry-${index}`
}

// The plan note after a successful check (spec FR-011).
export function checkedNoteText(forecastUpdatedAt: string): string {
  return `Checked against the forecast updated at ${forecastUpdatedAt}.`
}
