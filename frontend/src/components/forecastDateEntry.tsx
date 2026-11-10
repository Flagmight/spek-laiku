import { useState } from "react"
import { formatPlanDateLong } from "../helpers/formatPlanDate"
import { suitablePeriodText } from "../helpers/suitablePeriodText"
import type { ActivityDayForecast, ForecastDay } from "../types/planForecast"
import { ForecastHoursTable } from "./forecastHoursTable"

interface ForecastDateEntryProps {
  day: ForecastDay
  // The same date's verdicts for this activity.
  activityDay: ActivityDayForecast
  durationHours: number
  // The browser's id of the activity, to give the hours their own element id.
  activityId: string
  // The shown name, for example "Cycling 2".
  activityName: string
}

// One plan date under an activity (spec FR-021, FR-023): the date, sunrise and sunset, the suitable periods,
// and a button that shows and hides the date's hours.
export function ForecastDateEntry({
  day,
  activityDay,
  durationHours,
  activityId,
  activityName,
}: ForecastDateEntryProps) {
  const [open, setOpen] = useState(false)
  const date = formatPlanDateLong(day.date)
  const hoursId = `forecast-hours-${activityId}-${day.date}`
  const buttonText = `${open ? "Hide" : "Show"} hours for ${date}`

  return (
    <li className="forecast-date">
      <h3>{date}</h3>
      <p>{`Sunrise ${day.sunrise} · Sunset ${day.sunset}`}</p>
      <DatePeriods
        day={day}
        activityDay={activityDay}
        durationHours={durationHours}
      />
      {day.hours.length > 0 && (
        <>
          {/* The name starts with the visible text, so voice control users can say what they see. */}
          <button
            type="button"
            aria-expanded={open}
            aria-controls={hoursId}
            aria-label={`${buttonText}, ${activityName}`}
            onClick={() => setOpen(!open)}
          >
            {buttonText}
          </button>
          <div id={hoursId}>
            {open && (
              <ForecastHoursTable
                hours={day.hours}
                verdicts={activityDay.hours}
                activityName={activityName}
                date={date}
              />
            )}
          </div>
        </>
      )}
    </li>
  )
}

function DatePeriods({
  day,
  activityDay,
  durationHours,
}: Pick<ForecastDateEntryProps, "day" | "activityDay" | "durationHours">) {
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
