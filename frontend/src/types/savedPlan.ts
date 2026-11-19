import type { CheckedPlanActivity } from "./planActivity"
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

// A saved activity with the values it was saved with; it has no browser id until it is loaded for editing.
export type SavedPlanActivity = Omit<CheckedPlanActivity, "id">

// One saved plan exactly as it was saved (GET /api/plans/{id}). The scheduled, unscheduled and travel parts
// have the shapes of the schedule response (features 008 and 009). The location id and the activities are what
// "Edit plan" loads into the planning steps (feature 011 research section 4).
export interface SavedPlan {
  id: string
  name: string
  savedAt: string
  location: {
    id: number
    name: string
    area: string
    latitude: number
    longitude: number
  }
  dates: string[]
  maxTravelDistanceKm: number
  activities: SavedPlanActivity[]
  scheduled: ScheduledActivity[]
  unscheduled: UnscheduledActivity[]
  travel: TravelSummary
}
