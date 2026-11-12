import type { PlanForecast, PlanForecastRequest } from "../types/planForecast"
import { ApiError, apiFetch } from "./apiClient"

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

// Which part of the plan a 400 answer refuses, or undefined when it names neither.
async function outdatedPart(
  response: Response,
): Promise<"setupOutdated" | "activitiesOutdated" | undefined> {
  let keys: string[]
  try {
    const problem = (await response.json()) as { errors?: object }
    keys = Object.keys(problem.errors ?? {})
  } catch {
    return undefined
  }

  if (keys.some((key) => key.startsWith("setup"))) {
    return "setupOutdated"
  }

  return keys.some((key) => key.startsWith("activities"))
    ? "activitiesOutdated"
    : undefined
}

// The service named in a 503 answer, or undefined when the body cannot be read. Also read by the places API.
export async function failedService(response: Response): Promise<unknown> {
  try {
    const problem = (await response.json()) as { service?: unknown }
    return problem.service
  } catch {
    return undefined
  }
}
