import type { WeatherSnapshot } from "../types/planSchedule"

export function scheduleReasonText(reason: "noPlace" | "noSuitableTime"): string {
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
