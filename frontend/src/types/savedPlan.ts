import type {
  ScheduledActivity,
  TravelSummary,
  UnscheduledActivity,
} from "./planSchedule"

// Saved plans as /api/plans sends and receives them (feature 010 contracts/plans-api.md). Dates are
// "yyyy-MM-dd"; savedAt is a UTC ISO 8601 time. A plan always belongs to the signed-in user.

export interface SavedPlanSummary {
  id: string
  name: string
  locationName: string
  dates: string[]
  savedAt: string
}

// Only the remembered schedule's id and the name are sent; the schedule itself never is.
export interface SavePlanRequest {
  generatedScheduleId: string | null
  name: string
}

export type SavePlanFieldKey = "name" | "generatedScheduleId"

// One saved plan exactly as it was saved (GET /api/plans/{id}). The scheduled, unscheduled and travel parts
// have the shapes of the schedule response (features 008 and 009).
export interface SavedPlan {
  id: string
  name: string
  savedAt: string
  location: { name: string; area: string; latitude: number; longitude: number }
  dates: string[]
  maxTravelDistanceKm: number
  scheduled: ScheduledActivity[]
  unscheduled: UnscheduledActivity[]
  travel: TravelSummary
}
