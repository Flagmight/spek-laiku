import type { PlanForecastRequest } from "./planForecast"
import type { NearbyPlace } from "./planPlaces"

// The schedule for a plan as POST /api/plan-schedule sends it (contracts/plan-schedule-api.md).
// Dates are "yyyy-MM-dd" and times "HH:mm" in Lithuanian time. Every rule behind these values is
// decided on the server; the page only shows and words them.

export interface WeatherSnapshot {
  temperatureC: number | null
  rainMmPerHour: number | null
  windMs: number | null
  isIndoor: boolean
}

export interface ScheduledActivity {
  activityName: string
  date: string // "yyyy-MM-dd"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  place: NearbyPlace
  weather: WeatherSnapshot
}

export interface UnscheduledActivity {
  activityName: string
  reason: "noPlace" | "noSuitableTime"
}

export interface PlanSchedule {
  scheduled: ScheduledActivity[]
  unscheduled: UnscheduledActivity[]
}

// The same body as the forecast and places requests.
export type PlanScheduleRequest = PlanForecastRequest
