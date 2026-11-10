import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
import type { PlanForecastStatus as Status } from "../stores/usePlanForecastStore"

// The message for each failure; the page never shows a forecast with them (spec FR-006, FR-008).
const errorMessages: Partial<Record<Status, string>> = {
  weatherUnavailable:
    "The weather service is unavailable. No forecast is shown.",
  tooManyRequests: "Too many requests. Wait a minute and try again.",
  serverError: "Something went wrong. Try again.",
}

// The one status region of step 3 (spec FR-003, FR-006, FR-009, FR-027): its messages are announced
// without moving focus, and every error offers Retry.
export function PlanForecastStatus() {
  const status = usePlanForecastStore((state) => state.status)
  const updatedAt = usePlanForecastStore((state) => state.forecast?.updatedAt)
  const error = errorMessages[status]

  return (
    <div role="status" aria-label="Forecast" className="forecast-status">
      {status === "loading" && <p>Getting the forecast…</p>}
      {status === "loaded" && updatedAt && (
        <p>Forecast updated at {updatedAt}</p>
      )}
      {error && (
        <div className="server-error">
          <p>{formatErrorMessage(error)}</p>
          <button
            type="button"
            onClick={() => void usePlanForecastStore.getState().retry()}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
