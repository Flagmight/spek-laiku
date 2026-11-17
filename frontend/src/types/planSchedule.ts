import type { PlanForecastRequest } from "./planForecast"
import type { NearbyPlace } from "./planPlaces"

// The schedule for a plan as POST /api/plan-schedule sends it (contracts/plan-schedule-api.md of
// features 008 and 009). Dates are "yyyy-MM-dd" and times "HH:mm" in Lithuanian time. Every rule
// behind these values is decided on the server, including which place each activity uses and
// whether a trip is over the plan's maximum travel distance; the page only shows and words them.

export interface WeatherSnapshot {
  temperatureC: number | null
  rainMmPerHour: number | null
  windMs: number | null
  isIndoor: boolean
}

// The trip from the previous scheduled activity on the same date. The distance is already
// rounded to 0.1 km; overLimit is true when it is greater than the plan's maximum.
export interface TravelLeg {
  fromPlaceName: string
  distanceKm: number
  overLimit: boolean
}

// The plan-level travel check: the maximum used and how many trips are over it.
export interface TravelSummary {
  maxDistanceKm: number
  tripsOverLimit: number
}

export interface ScheduledActivity {
  activityName: string
  date: string // "yyyy-MM-dd"
  startTime: string // "HH:mm"
  endTime: string // "HH:mm"
  place: NearbyPlace
  weather: WeatherSnapshot
  travel: TravelLeg | null // null for the first activity of its date
}

export interface UnscheduledActivity {
  activityName: string
  reason: "noPlace" | "noSuitableTime"
}

export interface PlanSchedule {
  scheduled: ScheduledActivity[]
  unscheduled: UnscheduledActivity[]
  travel: TravelSummary
}

// The same body as the forecast and places requests.
export type PlanScheduleRequest = PlanForecastRequest
