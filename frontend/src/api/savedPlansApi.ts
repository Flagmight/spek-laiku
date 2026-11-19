import type {
  SavePlanFieldKey,
  SavePlanRequest,
  SavedPlan,
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

export type SavedPlansAnswer =
  | { kind: "plans"; plans: SavedPlanSummary[] }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }

// The signed-in user's plans, newest saved first as the server orders them (contracts/plans-api.md).
// Anything else throws ApiError. Network and abort errors pass through.
export async function getSavedPlans(
  signal?: AbortSignal,
): Promise<SavedPlansAnswer> {
  const response = await apiFetch(path, { signal })

  switch (response.status) {
    case 200:
      return {
        kind: "plans",
        plans: (await response.json()) as SavedPlanSummary[],
      }
    case 401:
      return { kind: "unauthorized" }
    case 403:
      return { kind: "forbidden" }
  }

  throw new ApiError(response.status)
}

export type SavedPlanAnswer =
  | { kind: "plan"; plan: SavedPlan }
  | { kind: "notFound" }
  | { kind: "forbidden" }
  | { kind: "unauthorized" }

// One of the signed-in user's plans (contracts/plans-api.md). Another user's plan is 403 and a plan that does
// not exist 404. Anything else throws ApiError. Network and abort errors pass through.
export async function getSavedPlan(
  id: string,
  signal?: AbortSignal,
): Promise<SavedPlanAnswer> {
  const response = await apiFetch(`${path}/${encodeURIComponent(id)}`, {
    signal,
  })

  switch (response.status) {
    case 200:
      return { kind: "plan", plan: (await response.json()) as SavedPlan }
    case 401:
      return { kind: "unauthorized" }
    case 403:
      return { kind: "forbidden" }
    case 404:
      return { kind: "notFound" }
  }

  throw new ApiError(response.status)
}

export type DeletePlanAnswer =
  | { kind: "deleted" }
  | { kind: "notFound" }
  | { kind: "forbidden" }
  | { kind: "unauthorized" }

// Deletes one of the signed-in user's plans permanently (feature 011 contracts/plans-api.md). A plan that does
// not exist, for example one already deleted, is 404; another user's plan is 403. Anything else throws ApiError.
// Network and abort errors pass through.
export async function deletePlan(
  id: string,
  signal?: AbortSignal,
): Promise<DeletePlanAnswer> {
  const response = await apiFetch(`${path}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    signal,
  })

  switch (response.status) {
    case 204:
      return { kind: "deleted" }
    case 401:
      return { kind: "unauthorized" }
    case 403:
      return { kind: "forbidden" }
    case 404:
      return { kind: "notFound" }
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
