import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { isFirstLoad } from "../helpers/isFirstLoad"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import type { PlanForecastStatus } from "../stores/usePlanForecastStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import type { PlanPlacesStatus } from "../stores/usePlanPlacesStore"

// The forecast's message for each failure; the page never shows a forecast with them (feature 006 FR-006).
const forecastErrors: Partial<Record<PlanForecastStatus, string>> = {
  weatherUnavailable:
    "The weather service is unavailable. No forecast is shown.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
  serverError: "Something went wrong. Try again.",
}

// The places' message for each failure; the page never shows places with them (feature 007 FR-009, FR-011).
const placesErrors: Partial<Record<PlanPlacesStatus, string>> = {
  mapUnavailable: "The map data service is unavailable. No places are shown.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
  serverError: "Something went wrong. Try again.",
}

// The one status region of step 3 (feature 006 FR-003, FR-006 and FR-027; feature 007 FR-003, FR-009 and
// FR-012). Its messages are announced without moving focus. While either part is first loading it shows
// only the combined loading message; afterwards a line for the forecast and a line for the places, each
// "updated at", its Retry in progress, or its error with its own Retry. Both errors can show at once.
export function PlacesAndForecastStatus() {
  const forecastStatus = usePlanForecastStore((state) => state.status)
  const forecastUpdatedAt = usePlanForecastStore(
    (state) => state.forecast?.updatedAt,
  )
  const placesStatus = usePlanPlacesStore((state) => state.status)
  const placesUpdatedAt = usePlanPlacesStore((state) => state.places?.updatedAt)
  const firstLoad = isFirstLoad(forecastStatus) || isFirstLoad(placesStatus)

  return (
    <div
      role="status"
      aria-label="Places and forecast"
      className="forecast-status"
    >
      {firstLoad ? (
        <p>Getting the forecast and nearby places…</p>
      ) : (
        <>
          <PartLine
            retrying={forecastStatus === "retrying"}
            retryingText="Getting the forecast…"
            updatedText={
              forecastStatus === "loaded" && forecastUpdatedAt
                ? `Forecast updated at ${forecastUpdatedAt}`
                : undefined
            }
            error={forecastErrors[forecastStatus]}
            onRetry={() => void usePlanForecastStore.getState().retry()}
          />
          <PartLine
            retrying={placesStatus === "retrying"}
            retryingText="Getting nearby places…"
            updatedText={
              placesStatus === "loaded" && placesUpdatedAt
                ? `Places updated at ${placesUpdatedAt}`
                : undefined
            }
            error={placesErrors[placesStatus]}
            onRetry={() => void usePlanPlacesStore.getState().retry()}
          />
        </>
      )}
    </div>
  )
}

interface PartLineProps {
  retrying: boolean
  retryingText: string
  updatedText: string | undefined
  error: string | undefined
  onRetry: () => void
}

// One part's line: its Retry in progress, its error with its own Retry, or when it was received.
function PartLine({
  retrying,
  retryingText,
  updatedText,
  error,
  onRetry,
}: PartLineProps) {
  if (retrying) {
    return <p>{retryingText}</p>
  }

  if (error) {
    return (
      <div className="server-error">
        <p>{formatErrorMessage(error)}</p>
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }

  return updatedText ? <p>{updatedText}</p> : null
}
