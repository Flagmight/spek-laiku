import { useState } from "react"
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

// One activity's forecast area (feature 006 FR-020 to FR-022, feature 007 FR-017): a summary line, then a
// "Show forecast details" button, closed at first, that shows one entry per plan date. The overview above
// already answers which date suits the activity, so the details stay closed until the user asks.
export function ActivityForecast({
  activity,
  name,
  forecast,
  days,
}: ActivityForecastProps) {
  const [open, setOpen] = useState(false)

  if (forecast.weatherIndependent) {
    return (
      <p className="forecast-summary">
        Weather does not affect this indoor activity. Every hour from 06:00 to
        22:00 is suitable.
      </p>
    )
  }

  const detailsId = `forecast-details-${activity.id}`
  const buttonText = `${open ? "Hide" : "Show"} forecast details`

  return (
    <>
      <p className="forecast-summary">
        {forecastSummaryText(forecast, days.length, activity.durationHours)}
      </p>
      {/* The name starts with the visible text, so voice control users can say what they see. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        aria-label={`${buttonText}, ${name}`}
        onClick={() => setOpen(!open)}
      >
        {buttonText}
      </button>
      <div id={detailsId}>
        {open && (
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
        )}
      </div>
    </>
  )
}
