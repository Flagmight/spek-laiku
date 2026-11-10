import type { PlanForecast, PlanForecastRequest } from "../types/planForecast"
import { ApiError, apiFetch } from "./apiClient"

const path = "/api/plan-forecast"

export type PlanForecastOutcome =
  | { kind: "forecast"; forecast: PlanForecast }
  | { kind: "weatherUnavailable" }
  | { kind: "tooManyRequests" }

// The forecast for the checked plan (contracts/plan-forecast-api.md). A 503 counts as the weather service
// only when the answer names it; a 503 from the location search service, and any other status, throws
// ApiError. Network and abort errors pass through, so callers treat them all as a server error.
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

  switch (response.status) {
    case 200:
      return {
        kind: "forecast",
        forecast: (await response.json()) as PlanForecast,
      }
    case 429:
      return { kind: "tooManyRequests" }
    case 503:
      if ((await failedService(response)) === "forecast") {
        return { kind: "weatherUnavailable" }
      }
      break
  }

  throw new ApiError(response.status)
}

// The service named in a 503 answer, or undefined when the body cannot be read.
async function failedService(response: Response): Promise<unknown> {
  try {
    const problem = (await response.json()) as { service?: unknown }
    return problem.service
  } catch {
    return undefined
  }
}
