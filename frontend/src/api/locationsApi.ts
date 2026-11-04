import type { PlanLocation } from "../types/planSetup"
import { ApiError, apiFetch } from "./apiClient"

interface LocationSearchResponse {
  locations: PlanLocation[]
}

// Places in Lithuania matching the text (spec FR-004). Any status other than 200, including 429 and
// 503, throws ApiError with that status, so the store can pick the message; network and abort errors
// pass through.
export async function searchLocations(
  query: string,
  signal?: AbortSignal,
): Promise<PlanLocation[]> {
  const response = await apiFetch(
    `/api/locations?query=${encodeURIComponent(query)}`,
    { signal },
  )
  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return ((await response.json()) as LocationSearchResponse).locations
}
