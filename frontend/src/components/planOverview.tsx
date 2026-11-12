import { formatPlanDateShort } from "../helpers/formatPlanDate"
import { dateCellText, placeCellText } from "../helpers/overviewCellText"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { PlanPlaces } from "../types/planPlaces"

interface PlanOverviewProps {
  activities: CheckedPlanActivity[]
  // The shown name of each activity by id, for example "Cycling 2".
  names: Record<string, string>
  forecast?: PlanForecast
  places?: PlanPlaces
}

// Every activity on every date at a glance (feature 007 FR-014 to FR-016): a row per activity in plan order,
// its nearest place, and the longest suitable period on each date, with each date's sunrise and sunset once
// in its column heading. Each cell starts with a label that is hidden on wide screens and shown in the phone
// cards, as in the hours table.
export function PlanOverview({
  activities,
  names,
  forecast,
  places,
}: PlanOverviewProps) {
  const days = forecast?.days ?? []

  return (
    <table className="plan-overview">
      <caption>Plan overview</caption>
      <thead>
        <tr>
          <th scope="col">Activity</th>
          <th scope="col">Place</th>
          {days.map((day) => (
            <th scope="col" key={day.date}>
              {`${formatPlanDateShort(day.date)} · Sunrise ${day.sunrise} · Sunset ${day.sunset}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {activities.map((activity, index) => {
          const categoryPlaces = places?.categories.find(
            (category) => category.categoryId === activity.categoryId,
          )
          const activityForecast = forecast?.activities[index]
          return (
            <tr key={activity.id}>
              <th scope="row">{names[activity.id]}</th>
              <td>
                <span className="cell-label">Place: </span>
                {categoryPlaces && placeCellText(categoryPlaces.places)}
              </td>
              {days.map((day, dayIndex) => (
                <td key={day.date}>
                  <span className="cell-label">
                    {`${formatPlanDateShort(day.date)}: `}
                  </span>
                  {activityForecast &&
                    dateCellText(day, activityForecast.days[dayIndex])}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
