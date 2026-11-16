import type { PlanSchedule, PlanScheduleRequest } from "../types/planSchedule"
import { ApiError, apiFetch } from "./apiClient"
import { failedService, outdatedPart } from "./planStepAnswer"

const path = "/api/plan-schedule"

export type PlanScheduleAnswer =
  | { kind: "schedule"; schedule: PlanSchedule }
  | { kind: "setupOutdated" }
  | { kind: "activitiesOutdated" }
  | { kind: "forbidden" }
  | { kind: "weatherUnavailable" }
  | { kind: "placesUnavailable" }
  | { kind: "tooManyRequests" }

// The schedule for the checked plan (contracts/plan-schedule-api.md). A 400 says which part of the plan
// the server found out of date, as for the forecast and places. A 503 names the failed service: "forecast"
// or "places". Anything else throws ApiError. Network and abort errors pass through.
export async function getPlanSchedule(
  request: PlanScheduleRequest,
  signal?: AbortSignal,
): Promise<PlanScheduleAnswer> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  switch (response.status) {
    case 200:
      return {
        kind: "schedule",
        schedule: (await response.json()) as PlanSchedule,
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
    case 503: {
      const service = await failedService(response)
      if (service === "forecast") {
        return { kind: "weatherUnavailable" }
      }
      if (service === "places") {
        return { kind: "placesUnavailable" }
      }
      break
    }
  }

  throw new ApiError(response.status)
}
