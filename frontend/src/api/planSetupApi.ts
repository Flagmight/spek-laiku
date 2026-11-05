import type {
  CheckedPlanSetup,
  PlanPeriod,
  PlanSetupCheckRequest,
  PlanSetupFieldErrors,
  PlanSetupFieldKey,
} from "../types/planSetup"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/plan-setup"

// The keys the check can return (contracts/plan-setup-api.md); dates[i] points at one sent date.
const fieldKey = /^(locationId|dates|maxTravelDistanceKm|dates\[\d+\])$/

export type PlanSetupCheckOutcome =
  | { kind: "checked"; setup: CheckedPlanSetup }
  | { kind: "invalid"; errors: PlanSetupFieldErrors }
  | { kind: "forbidden" }
  | { kind: "tooManyRequests" }

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// The forecast period and the date limit, worked out by the server (spec FR-010). Any status other
// than 200 throws ApiError; network and abort errors pass through.
export async function getPlanPeriod(signal?: AbortSignal): Promise<PlanPeriod> {
  const response = await apiFetch(`${basePath}/period`, { signal })
  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as PlanPeriod
}

// Checks the setup on the server (spec FR-012). Any other status, including a 400 without known
// field errors and 503, throws ApiError; network and abort errors pass through, so callers treat
// them all as a server error.
export async function checkPlanSetup(
  request: PlanSetupCheckRequest,
  signal?: AbortSignal,
): Promise<PlanSetupCheckOutcome> {
  const response = await apiFetch(`${basePath}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  switch (response.status) {
    case 200:
      return {
        kind: "checked",
        setup: (await response.json()) as CheckedPlanSetup,
      }
    case 400: {
      const errors = await readFieldErrors(response)
      if (Object.keys(errors).length > 0) {
        return { kind: "invalid", errors }
      }
      break
    }
    case 403:
      return { kind: "forbidden" }
    case 429:
      return { kind: "tooManyRequests" }
  }

  throw new ApiError(response.status)
}

// The first message for each known field, in the order the server sent them.
async function readFieldErrors(
  response: Response,
): Promise<PlanSetupFieldErrors> {
  const problem = (await response.json()) as ValidationProblem
  const errors: PlanSetupFieldErrors = {}
  for (const [key, messages] of Object.entries(problem.errors ?? {})) {
    const message = messages?.[0]
    if (fieldKey.test(key) && message) {
      errors[key as PlanSetupFieldKey] = message
    }
  }

  return errors
}
