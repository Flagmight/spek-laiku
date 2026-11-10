import type { PlanActivityRequest } from "./planActivity"
import type { PlanSetupCheckRequest } from "./planSetup"

// The forecast for a plan as POST /api/plan-forecast sends it (contracts/plan-forecast-api.md).
// Dates are "yyyy-MM-dd" and times "HH:mm" in Lithuanian time. Every rule behind these values is
// decided on the server; the page only shows and words them.

// One planning hour of a plan date. A value is null when the weather service has none ("No data").
export interface ForecastHour {
  start: string
  end: string
  temperatureC: number | null
  rainMmPerHour: number | null
  windMs: number | null
  daylight: boolean
}

export interface ForecastDay {
  date: string
  sunrise: string
  sunset: string
  // Empty when the date is today and no planning hour is left.
  hours: ForecastHour[]
}

export interface SuitablePeriod {
  start: string
  end: string
  lengthHours: number
  shorterThanDuration: boolean
}

// The verdict for one hour; an empty reasons list means suitable.
export interface HourSuitability {
  start: string
  suitable: boolean
  reasons: string[]
}

// One activity on one date; hours line up with the same date's ForecastDay.hours.
export interface ActivityDayForecast {
  date: string
  periods: SuitablePeriod[]
  hours: HourSuitability[]
}

export interface ActivityForecast {
  weatherIndependent: boolean
  suitableHours: number
  datesWithSuitableHours: number
  hasLongEnoughPeriod: boolean
  days: ActivityDayForecast[]
}

// activities are in the order they were sent.
export interface PlanForecast {
  updatedAt: string
  days: ForecastDay[]
  activities: ActivityForecast[]
}

// The checked setup and activities, in the shapes of the two Continue checks.
export interface PlanForecastRequest {
  setup: PlanSetupCheckRequest
  activities: PlanActivityRequest[]
}
