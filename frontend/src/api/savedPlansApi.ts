import type {
  SavePlanFieldKey,
  SavePlanRequest,
  SavedPlanSummary,
} from "../types/savedPlan"
import { ApiError, apiFetch } from "./apiClient"

const path = "/api/plans"

export type SavePlanAnswer =
  | { kind: "saved"; plan: SavedPlanSummary }
  | { kind: "invalid"; errors: Partial<Record<SavePlanFieldKey, string>> }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }

// Saves a remembered schedule under the signed-in user (contracts/plans-api.md). 201 is a new plan and 200
// the plan this schedule was already saved as; both are a success. A 400 names the refused fields; only the
// first message of each is shown. Anything else throws ApiError. Network and abort errors pass through.
export async function savePlan(
  request: SavePlanRequest,
  signal?: AbortSignal,
): Promise<SavePlanAnswer> {
  const response = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  switch (response.status) {
    case 200:
    case 201:
      return {
        kind: "saved",
        plan: (await response.json()) as SavedPlanSummary,
      }
    case 400:
      return { kind: "invalid", errors: await fieldErrors(response) }
    case 401:
      return { kind: "unauthorized" }
    case 403:
      return { kind: "forbidden" }
  }

  throw new ApiError(response.status)
}

async function fieldErrors(
  response: Response,
): Promise<Partial<Record<SavePlanFieldKey, string>>> {
  try {
    const problem = (await response.json()) as {
      errors?: Record<string, string[] | undefined>
    }
    const errors: Partial<Record<SavePlanFieldKey, string>> = {}
    for (const key of ["name", "generatedScheduleId"] as const) {
      const message = problem.errors?.[key]?.[0]
      if (message) {
        errors[key] = message
      }
    }
    return errors
  } catch {
    return {}
  }
}
