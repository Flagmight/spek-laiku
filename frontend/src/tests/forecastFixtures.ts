import type {
  ActivityForecast,
  ForecastDay,
  ForecastHour,
  PlanForecast,
} from "../types/planForecast"
import { jsonResponse } from "./renderApp"
import type { RecordedRequest } from "./renderApp"

// Forecast answers for tests, shaped like POST /api/plan-forecast (contracts/plan-forecast-api.md).

export function forecastHour(
  start: number,
  changes: Partial<ForecastHour> = {},
): ForecastHour {
  const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`
  return {
    start: pad(start),
    end: pad(start + 1),
    temperatureC: 18,
    rainMmPerHour: 0,
    windMs: 3,
    daylight: start >= 8 && start < 16,
    ...changes,
  }
}

// A plan date with the hours from firstHour to 21:00, sunrise 07:46 and sunset 16:15.
export function forecastDay(date: string, firstHour = 6): ForecastDay {
  const hours: ForecastHour[] = []
  for (let hour = firstHour; hour < 22; hour++) {
    hours.push(forecastHour(hour))
  }

  return { date, sunrise: "07:46", sunset: "16:15", hours }
}

// An activity that is suitable in daylight (08:00 to 16:00) on every given day.
export function daylightActivityForecast(
  days: ForecastDay[],
  changes: Partial<ActivityForecast> = {},
): ActivityForecast {
  return {
    weatherIndependent: false,
    suitableHours: 8 * days.length,
    datesWithSuitableHours: days.length,
    hasLongEnoughPeriod: true,
    days: days.map((day) => ({
      date: day.date,
      periods:
        day.hours.length === 0
          ? []
          : [
              {
                start: "08:00",
                end: "16:00",
                lengthHours: 8,
                shorterThanDuration: false,
              },
            ],
      hours: day.hours.map((hour) => ({
        start: hour.start,
        suitable: hour.daylight,
        reasons: hour.daylight ? [] : ["Outside daylight"],
      })),
    })),
    ...changes,
  }
}

// A forecast for the given dates where every activity is suitable in daylight.
export function planForecast(
  dates: string[],
  activityCount: number,
): PlanForecast {
  const days = dates.map((date) => forecastDay(date))
  return {
    updatedAt: "14:05",
    days,
    activities: Array.from({ length: activityCount }, () =>
      daylightActivityForecast(days),
    ),
  }
}

// Answers POST /api/plan-forecast for whatever dates and activities were sent, every activity suitable in
// daylight. Tests that only pass through step 3 spread forecastRoutes into their routeFetch handlers.
export function answerForecast(request: RecordedRequest): Response {
  const body = request.body as {
    setup: { dates: string[] }
    activities: unknown[]
  }
  return jsonResponse(
    200,
    planForecast(body.setup.dates, body.activities.length),
  )
}

export const forecastRoutes = { "POST /api/plan-forecast": answerForecast }
