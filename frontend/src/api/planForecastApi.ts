import type { PlanForecast, PlanForecastRequest } from "../types/planForecast"
import { ApiError, apiFetch } from "./apiClient"
import { failedService, outdatedPart } from "./planStepAnswer"

const path = "/api/plan-forecast"

export type PlanForecastOutcome =
  | { kind: "forecast"; forecast: PlanForecast }
  | { kind: "setupOutdated" }
  | { kind: "activitiesOutdated" }
  | { kind: "forbidden" }
  | { kind: "weatherUnavailable" }
  | { kind: "tooManyRequests" }

// The forecast for the checked plan (contracts/plan-forecast-api.md). A 400 says which part of the plan the
// server found out of date: any "setup" key means the setup, otherwise any "activities" key the
// activities. A 503 counts as the weather service only when the answer names it. Anything else, including
// a 400 with only "request" and a 503 from the location search service, throws ApiError. Network and abort
// errors pass through, so callers treat them all as a server error.
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
    case 400: {
      const outdated = await outdatedPart(response)
      if (outdated) {
        return { kind: outdated }
      }
      break
    }
    case 403:
      return { kind: "forbidden" }
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
