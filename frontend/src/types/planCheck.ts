import type { WeatherSnapshot } from "./planSchedule"

// A saved plan checked against the latest forecast, as GET /api/plans/{id}/check sends it (feature 012
// contracts/plan-check-api.md). Dates are "yyyy-MM-dd" and times "HH:mm" in Lithuanian time. The server decides
// every rule: which activities have started, which limits are broken, the worst value and its hour. The page
// only words the answer (research section 11).

export type PlanRule =
  | "wind"
  | "rain"
  | "cold"
  | "heat"
  | "noForecast"
  | "beforeSunrise"
  | "afterSunset"
  | "overlap"
  | "travel"

// One broken rule. Each rule fills only its own fields; the others are null (contract "Problem fields").
export interface PlanProblem {
  rule: PlanRule
  time: string | null
  value: number | null
  limit: number | null
  sunTime: string | null
  otherActivityName: string | null
  otherStartTime: string | null
  otherEndTime: string | null
  fromPlaceName: string | null
}

// One scheduled activity of the saved plan, in the same order as the plan's scheduled list. A past entry has
// no weather and no problems.
export interface PlanCheckEntry {
  date: string
  startTime: string
  endTime: string
  activityName: string
  past: boolean
  weather: WeatherSnapshot | null
  problems: PlanProblem[]
}

export interface PlanCheck {
  // The checked plan's savedAt; when it differs from the plan on the page, the plan was replaced since.
  savedAt: string
  status: "checked" | "allPast"
  // When the forecast used was received from the weather service; null for "allPast".
  forecastUpdatedAt: string | null
  entries: PlanCheckEntry[]
}
