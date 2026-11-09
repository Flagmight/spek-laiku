import type { PlanCategory } from "../types/planActivity"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/plan-activities"

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
