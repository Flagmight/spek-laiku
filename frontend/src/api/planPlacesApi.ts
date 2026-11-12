import type { PlanPlaces, PlanPlacesRequest } from "../types/planPlaces"
import { ApiError, apiFetch } from "./apiClient"
import { failedService, outdatedPart } from "./planStepAnswer"

const path = "/api/plan-places"

export type PlanPlacesOutcome =
  | { kind: "places"; places: PlanPlaces }
  | { kind: "setupOutdated" }
  | { kind: "activitiesOutdated" }
  | { kind: "mapUnavailable" }
  | { kind: "tooManyRequests" }

// The places for the checked plan (contracts/plan-places-api.md). A 400 says which part of the plan the
// server found out of date, as for the forecast. A 503 counts as the map data service only when the answer
// names it. Anything else, including a 400 with only "request" and a 503 from the location search service,
// throws ApiError. Network and abort errors pass through, so callers treat them all as a server error.
export async function getPlanPlaces(
  request: PlanPlacesRequest,
  signal?: AbortSignal,
): Promise<PlanPlacesOutcome> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  switch (response.status) {
    case 200:
      return { kind: "places", places: (await response.json()) as PlanPlaces }
    case 400: {
      const outdated = await outdatedPart(response)
      if (outdated) {
        return { kind: outdated }
      }
      break
    }
    case 429:
      return { kind: "tooManyRequests" }
    case 503:
      if ((await failedService(response)) === "places") {
        return { kind: "mapUnavailable" }
      }
      break
  }

  throw new ApiError(response.status)
}
