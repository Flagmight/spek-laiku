import { forecastSummaryText } from "../helpers/forecastSummaryText"
import type { CheckedPlanActivity } from "../types/planActivity"
import type {
  ActivityForecast as ActivityForecastData,
  ForecastDay,
} from "../types/planForecast"
import { ForecastDateEntry } from "./forecastDateEntry"

interface ActivityForecastProps {
  activity: CheckedPlanActivity
  // The shown name, for example "Cycling 2", used to name each date's hours.
  name: string
  forecast: ActivityForecastData
  // The plan's dates; forecast.days lines up with them by position.
  days: ForecastDay[]
}

// One activity's forecast area (spec FR-020 to FR-022): a summary line, then one entry per plan date.
export function ActivityForecast({
  activity,
  name,
  forecast,
  days,
}: ActivityForecastProps) {
  if (forecast.weatherIndependent) {
    return (
      <p className="forecast-summary">
        Weather does not affect this indoor activity. Every hour from 06:00 to
        22:00 is suitable.
      </p>
    )
  }

  return (
    <>
      <p className="forecast-summary">
        {forecastSummaryText(forecast, days.length, activity.durationHours)}
      </p>
      <ul className="forecast-dates">
        {days.map((day, index) => (
          <ForecastDateEntry
            key={day.date}
            day={day}
            activityDay={forecast.days[index]}
            durationHours={activity.durationHours}
            activityId={activity.id}
            activityName={name}
          />
        ))}
      </ul>
    </>
  )
}
