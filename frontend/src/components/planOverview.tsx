import { formatPlanDateShort } from "../helpers/formatPlanDate"
import {
  dateCellText,
  missingCellText,
  placeCellText,
} from "../helpers/overviewCellText"
import type { StepPartState } from "../helpers/stepPartState"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { PlanPlaces } from "../types/planPlaces"

interface PlanOverviewProps {
  activities: CheckedPlanActivity[]
  // The shown name of each activity by id, for example "Cycling 2".
  names: Record<string, string>
  // The checked plan dates, for the columns when there is no forecast.
  dates: string[]
  forecastState: StepPartState
  forecast?: PlanForecast
  placesState: StepPartState
  places?: PlanPlaces
}

// Every activity on every date at a glance (feature 007 FR-014 to FR-016): a row per activity in plan order,
// its nearest place, and the longest suitable period on each date, with each date's sunrise and sunset once
// in its column heading. Without the forecast or the places the overview stays, and their cells say they
// are being asked for again or are not available. Each cell starts with a label that is hidden on wide
// screens and shown in the phone cards, as in the hours table.
export function PlanOverview({
  activities,
  names,
  dates,
  forecastState,
  forecast,
  placesState,
  places,
}: PlanOverviewProps) {
  const days = forecastState === "loaded" ? forecast?.days : undefined
  const columns = days?.map((day) => day.date) ?? dates

  function placeCell(activity: CheckedPlanActivity) {
    if (placesState !== "loaded") {
      return missingCellText(placesState, "Getting nearby places…")
    }

    const categoryPlaces = places?.categories.find(
      (category) => category.categoryId === activity.categoryId,
    )
    return categoryPlaces ? placeCellText(categoryPlaces.places) : ""
  }

  function dateCell(index: number, dayIndex: number) {
    const activityDay = forecast?.activities[index]?.days[dayIndex]
    if (forecastState !== "loaded" || !days || !activityDay) {
      return missingCellText(
        forecastState === "retrying" ? "retrying" : "unavailable",
        "Getting the forecast…",
      )
    }

    return dateCellText(days[dayIndex], activityDay)
  }

  return (
    <table className="plan-overview">
      <caption>Plan overview</caption>
      <thead>
        <tr>
          <th scope="col">Activity</th>
          <th scope="col">Place</th>
          {columns.map((date, dayIndex) => (
            <th scope="col" key={date}>
              {days
                ? `${formatPlanDateShort(date)} · Sunrise ${days[dayIndex].sunrise} · Sunset ${days[dayIndex].sunset}`
                : formatPlanDateShort(date)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {activities.map((activity, index) => (
          <tr key={activity.id}>
            <th scope="row">{names[activity.id]}</th>
            <td>
              <span className="cell-label">Place: </span>
              {placeCell(activity)}
            </td>
            {columns.map((date, dayIndex) => (
              <td key={date}>
                <span className="cell-label">
                  {`${formatPlanDateShort(date)}: `}
                </span>
                {dateCell(index, dayIndex)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
