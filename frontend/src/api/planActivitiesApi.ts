import type {
  CheckedPlanActivity,
  PlanActivitiesCheckRequest,
  PlanCategory,
} from "../types/planActivity"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/plan-activities"

// The server never sees the browser's ids; the check store adds them back by position.
export type ServerCheckedPlanActivity = Omit<CheckedPlanActivity, "id">

export type PlanActivitiesCheckOutcome =
  | { kind: "checked"; activities: ServerCheckedPlanActivity[] }
  | { kind: "invalid"; errors: Record<string, string> }
  | { kind: "forbidden" }

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

export interface PlanCategoryList {
  categories: PlanCategory[]
  maxActivities: number
}

// The categories for planning and the most activities one plan may have. Any status other than 200
// throws ApiError; network and abort errors pass through.
export async function listPlanCategories(
  signal?: AbortSignal,
): Promise<PlanCategoryList> {
  const response = await apiFetch(`${basePath}/categories`, { signal })
  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as PlanCategoryList
}

// Checks every activity on the server (spec FR-013). Any other status, including a 400 without
// activities keys, throws ApiError; network and abort errors pass through, so callers treat them all
// as a server error.
export async function checkPlanActivities(
  request: PlanActivitiesCheckRequest,
  signal?: AbortSignal,
): Promise<PlanActivitiesCheckOutcome> {
  const response = await apiFetch(`${basePath}/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  switch (response.status) {
    case 200: {
      const body = (await response.json()) as {
        activities: ServerCheckedPlanActivity[]
      }
      return { kind: "checked", activities: body.activities }
    }
    case 400: {
      const errors = await readActivityErrors(response)
      if (Object.keys(errors).length > 0) {
        return { kind: "invalid", errors }
      }
      break
    }
    case 403:
      return { kind: "forbidden" }
  }

  throw new ApiError(response.status)
}

// The first message of every activities key, in the order the server sent them.
async function readActivityErrors(
  response: Response,
): Promise<Record<string, string>> {
  const problem = (await response.json()) as ValidationProblem
  const errors: Record<string, string> = {}
  for (const [key, messages] of Object.entries(problem.errors ?? {})) {
    const message = messages?.[0]
    if (key.startsWith("activities") && message) {
      errors[key] = message
    }
  }

  return errors
}
