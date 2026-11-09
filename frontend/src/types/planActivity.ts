import type { ActivityType } from "./activityCategory"

// A category as planners get it (contracts/plan-activities-api.md). The limits are null for Indoor.
export interface PlanCategory {
  id: string
  name: string
  type: ActivityType
  defaultDurationHours: number
  requiresDaylight: boolean
  maxWindMs: number | null
  maxRainMmPerHour: number | null
  minTemperatureC: number | null
  maxTemperatureC: number | null
}

// One activity of the plan as entered. The id exists only in the browser, and the numbers stay as
// typed so the server can answer with the field's message.
export interface PlanActivity {
  id: string
  categoryId: string
  name: string
  type: ActivityType
  durationText: string
  requiresDaylight: boolean
  maxWindText: string
  maxRainText: string
  minTemperatureText: string
  maxTemperatureText: string
}

// An activity the server accepted, matched back to the sent id by position.
export interface CheckedPlanActivity {
  id: string
  categoryId: string
  name: string
  type: ActivityType
  durationHours: number
  requiresDaylight: boolean
  maxWindMs: number | null
  maxRainMmPerHour: number | null
  minTemperatureC: number | null
  maxTemperatureC: number | null
}

// "activity" holds the message for the whole activity (the activities[i] key).
export type PlanActivityField =
  | "activity"
  | "durationHours"
  | "maxWindMs"
  | "maxRainMmPerHour"
  | "minTemperatureC"
  | "maxTemperatureC"

export interface PlanActivityErrors {
  list?: string
  byActivity: Record<string, Partial<Record<PlanActivityField, string>>>
}

// One activity in the check request. A number that is empty or not a number is sent as null.
export interface PlanActivityRequest {
  categoryId: string
  type: ActivityType
  durationHours: number | null
  requiresDaylight: boolean
  maxWindMs: number | null
  maxRainMmPerHour: number | null
  minTemperatureC: number | null
  maxTemperatureC: number | null
}

export interface PlanActivitiesCheckRequest {
  activities: PlanActivityRequest[]
}
