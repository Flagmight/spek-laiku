import type { PlanForecast, PlanForecastRequest } from "../types/planForecast"
import { ApiError, apiFetch } from "./apiClient"

const path = "/api/plan-forecast"

export type PlanForecastOutcome = { kind: "forecast"; forecast: PlanForecast }

// The forecast for the checked plan (contracts/plan-forecast-api.md). Any other status throws ApiError;
// network and abort errors pass through, so callers treat them all as a server error.
export async function getPlanForecast(
  request: PlanForecastRequest,
  signal?: AbortSignal,
): Promise<PlanForecastOutcome> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  if (response.status === 200) {
    return {
      kind: "forecast",
      forecast: (await response.json()) as PlanForecast,
    }
  }

  throw new ApiError(response.status)
}
