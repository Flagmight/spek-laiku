import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { isFirstLoad } from "../helpers/isFirstLoad"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import type { PlanForecastStatus } from "../stores/usePlanForecastStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"

// The forecast's message for each failure; the page never shows a forecast with them (feature 006 FR-006).
const forecastErrors: Partial<Record<PlanForecastStatus, string>> = {
  weatherUnavailable:
    "The weather service is unavailable. No forecast is shown.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
  serverError: "Something went wrong. Try again.",
}

// The one status region of step 3 (feature 006 FR-003, FR-006 and FR-027; feature 007 FR-003 and FR-012).
// Its messages are announced without moving focus. While either part is first loading it shows only the
// combined loading message; afterwards a line for the forecast and a line for the places.
export function PlacesAndForecastStatus() {
  const forecastStatus = usePlanForecastStore((state) => state.status)
  const forecastUpdatedAt = usePlanForecastStore(
    (state) => state.forecast?.updatedAt,
  )
  const placesStatus = usePlanPlacesStore((state) => state.status)
  const placesUpdatedAt = usePlanPlacesStore((state) => state.places?.updatedAt)
  const firstLoad = isFirstLoad(forecastStatus) || isFirstLoad(placesStatus)
  const forecastError = forecastErrors[forecastStatus]

  return (
    <div
      role="status"
      aria-label="Places and forecast"
      className="forecast-status"
    >
      {firstLoad && <p>Getting the forecast and nearby places…</p>}
      {!firstLoad && (
        <>
          {forecastStatus === "retrying" && <p>Getting the forecast…</p>}
          {forecastStatus === "loaded" && forecastUpdatedAt && (
            <p>Forecast updated at {forecastUpdatedAt}</p>
          )}
          {forecastError && (
            <div className="server-error">
              <p>{formatErrorMessage(forecastError)}</p>
              <button
                type="button"
                onClick={() => void usePlanForecastStore.getState().retry()}
              >
                Retry
              </button>
            </div>
          )}
          {placesStatus === "loaded" && placesUpdatedAt && (
            <p>Places updated at {placesUpdatedAt}</p>
          )}
        </>
      )}
    </div>
  )
}
