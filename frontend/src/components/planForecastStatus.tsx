import { usePlanForecastStore } from "../stores/usePlanForecastStore"

// The one status region of step 3 (spec FR-003, FR-009, FR-027): its messages are announced without moving
// focus.
export function PlanForecastStatus() {
  const status = usePlanForecastStore((state) => state.status)
  const updatedAt = usePlanForecastStore((state) => state.forecast?.updatedAt)

  return (
    <div role="status" aria-label="Forecast" className="forecast-status">
      {status === "loading" && <p>Getting the forecast…</p>}
      {status === "loaded" && updatedAt && (
        <p>Forecast updated at {updatedAt}</p>
      )}
    </div>
  )
}
