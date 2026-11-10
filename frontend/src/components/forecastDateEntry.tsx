import { formatPlanDateLong } from "../helpers/formatPlanDate"
import { suitablePeriodText } from "../helpers/suitablePeriodText"
import type { ActivityDayForecast, ForecastDay } from "../types/planForecast"

interface ForecastDateEntryProps {
  day: ForecastDay
  // The same date's verdicts for this activity.
  activityDay: ActivityDayForecast
  durationHours: number
}

// One plan date under an activity (spec FR-021): the date, sunrise and sunset, and the suitable periods.
export function ForecastDateEntry({
  day,
  activityDay,
  durationHours,
}: ForecastDateEntryProps) {
  return (
    <li className="forecast-date">
      <h3>{formatPlanDateLong(day.date)}</h3>
      <p>{`Sunrise ${day.sunrise} · Sunset ${day.sunset}`}</p>
      <DatePeriods
        day={day}
        activityDay={activityDay}
        durationHours={durationHours}
      />
    </li>
  )
}

function DatePeriods({
  day,
  activityDay,
  durationHours,
}: ForecastDateEntryProps) {
  if (day.hours.length === 0) {
    return <p>No hours left to plan today.</p>
  }

  if (activityDay.periods.length === 0) {
    return <p>✗ No suitable hours on this date.</p>
  }

  return (
    <ul className="forecast-periods">
      {activityDay.periods.map((period) => (
        <li key={period.start}>{suitablePeriodText(period, durationHours)}</li>
      ))}
    </ul>
  )
}
