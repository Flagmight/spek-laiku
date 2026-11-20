import type { PlanCheck } from "../types/planCheck"
import { ApiError, apiFetch } from "./apiClient"
import { failedService } from "./planStepAnswer"

export type PlanCheckAnswer =
  | { kind: "check"; check: PlanCheck }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "notFound" }
  | { kind: "tooManyRequests" }
  | { kind: "weatherUnavailable" }

// Checks one of the signed-in user's saved plans against the latest forecast (feature 012
// contracts/plan-check-api.md). The check changes nothing, so it can be sent again at any time. A 503 counts as
// the weather service only when the answer names it. Anything else throws ApiError. Network and abort errors
// pass through, so the caller treats them all as a server error.
export async function checkPlan(
  id: string,
  signal?: AbortSignal,
): Promise<PlanCheckAnswer> {
  const response = await apiFetch(
    `/api/plans/${encodeURIComponent(id)}/check`,
    { signal },
  )

  switch (response.status) {
    case 200:
      return { kind: "check", check: (await response.json()) as PlanCheck }
    case 401:
      return { kind: "unauthorized" }
    case 403:
      return { kind: "forbidden" }
    case 404:
      return { kind: "notFound" }
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
