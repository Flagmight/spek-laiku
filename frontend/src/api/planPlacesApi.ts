import type { PlanPlaces, PlanPlacesRequest } from "../types/planPlaces"
import { ApiError, apiFetch } from "./apiClient"

const path = "/api/plan-places"

export type PlanPlacesOutcome = { kind: "places"; places: PlanPlaces }

// The places for the checked plan (contracts/plan-places-api.md). Every answer other than 200 throws
// ApiError for now; the stories for the out-of-date plan, access and the map data service add their own
// outcomes. Network and abort errors pass through, so callers treat them all as a server error.
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

  if (response.status === 200) {
    return { kind: "places", places: (await response.json()) as PlanPlaces }
  }

  throw new ApiError(response.status)
}
