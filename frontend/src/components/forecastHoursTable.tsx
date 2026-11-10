import type { ForecastHour, HourSuitability } from "../types/planForecast"

interface ForecastHoursTableProps {
  hours: ForecastHour[]
  // The same hours' verdicts for this activity, in the same order.
  verdicts: HourSuitability[]
  activityName: string
  // The long date, for example "Saturday 14 November 2026".
  date: string
}

// Every hour of one date for one activity (spec FR-023, FR-024): values, daylight, suitability and every
// reason. Each cell starts with its own label, which phones show when the rows become cards (spec FR-026).
export function ForecastHoursTable({
  hours,
  verdicts,
  activityName,
  date,
}: ForecastHoursTableProps) {
  return (
    <table className="forecast-hours">
      <caption>{`Hours for ${activityName} on ${date}`}</caption>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Temperature</th>
          <th scope="col">Rain</th>
          <th scope="col">Wind</th>
          <th scope="col">Daylight</th>
          <th scope="col">Suitability</th>
        </tr>
      </thead>
      <tbody>
        {hours.map((hour, index) => (
          <HourRow key={hour.start} hour={hour} verdict={verdicts[index]} />
        ))}
      </tbody>
    </table>
  )
}

function HourRow({
  hour,
  verdict,
}: {
  hour: ForecastHour
  verdict: HourSuitability
}) {
  return (
    <tr>
      <Cell label="Time">{`${hour.start}–${hour.end}`}</Cell>
      <Cell label="Temperature">{shown(hour.temperatureC, "°C")}</Cell>
      <Cell label="Rain">{shown(hour.rainMmPerHour, "mm/h")}</Cell>
      <Cell label="Wind">{shown(hour.windMs, "m/s")}</Cell>
      <Cell label="Daylight">{hour.daylight ? "Yes" : "No"}</Cell>
      <Cell label="Suitability">
        {verdict.suitable ? (
          "★ Suitable"
        ) : (
          <>
            ✗ Unsuitable
            <ul className="forecast-reasons">
              {verdict.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </>
        )}
      </Cell>
    </tr>
  )
}

function Cell({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <td>
      <span className="cell-label">{label}: </span>
      {children}
    </td>
  )
}

// The server already rounded the value; one decimal place is display only. A missing value is "No data".
function shown(value: number | null, unit: string): string {
  return value === null ? "No data" : `${value.toFixed(1)} ${unit}`
}
