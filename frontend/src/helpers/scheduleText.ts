import { kmText } from "./placeText"
import type {
  ScheduledActivity,
  TravelLeg,
  TravelSummary,
  WeatherSnapshot,
} from "../types/planSchedule"

export function scheduleReasonText(
  reason: "noPlace" | "noSuitableTime",
): string {
  return reason === "noPlace" ? "No place found" : "No suitable time found"
}

export function scheduleWeatherText(weather: WeatherSnapshot): string {
  if (weather.isIndoor) {
    return "Weather does not affect this indoor activity."
  }

  const parts: string[] = []
  if (weather.windMs !== null) {
    parts.push(`${weather.windMs} m/s wind`)
  }
  if (weather.rainMmPerHour !== null) {
    parts.push(`${weather.rainMmPerHour} mm/h rain`)
  }
  if (weather.temperatureC !== null) {
    parts.push(`${weather.temperatureC} °C`)
  }
  return parts.join(", ")
}

// The trip to an activity from the previous one on the same date (feature 009 spec FR-007). The
// server has already rounded the distance and decided whether it is over the plan's maximum; the
// distance is worded by kmText, like the place distances, and an over-limit trip is marked with ✗
// and words, never colour alone (spec FR-012).
export function travelText(
  travel: TravelLeg | null,
  maxDistanceKm: number,
): string {
  if (travel === null) {
    return "Travel: Start of the day"
  }

  const trip = `${kmText(travel.distanceKm)} from ${travel.fromPlaceName}`
  return travel.overLimit
    ? `Travel: ✗ ${trip}, more than your ${maxDistanceKm} km limit`
    : `Travel: ${trip}`
}

// The plan-level travel summary (spec FR-008), or null when no date has two or more scheduled
// activities, because then there is no trip to check.
export function travelSummaryText(
  scheduled: ScheduledActivity[],
  summary: TravelSummary,
): string | null {
  if (scheduled.every((activity) => activity.travel === null)) {
    return null
  }

  const limit = `your ${summary.maxDistanceKm} km limit`
  if (summary.tripsOverLimit === 0) {
    return `✓ All trips within ${limit}.`
  }

  const trips = summary.tripsOverLimit === 1 ? "trip" : "trips"
  return `✗ ${summary.tripsOverLimit} ${trips} longer than ${limit}.`
}
