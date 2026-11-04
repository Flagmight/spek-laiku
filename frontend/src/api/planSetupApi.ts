import type { PlanPeriod } from "../types/planSetup"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/plan-setup"

// The forecast period and the date limit, worked out by the server (spec FR-010). Any status other
// than 200 throws ApiError; network and abort errors pass through.
export async function getPlanPeriod(signal?: AbortSignal): Promise<PlanPeriod> {
  const response = await apiFetch(`${basePath}/period`, { signal })
  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as PlanPeriod
}
