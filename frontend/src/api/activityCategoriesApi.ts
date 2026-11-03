import type {
  ActivityCategory,
  ActivityCategoryField,
  ActivityCategoryFieldErrors,
  ActivityCategoryRequest,
} from "../types/activityCategory"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/admin/categories"

const categoryFields: ActivityCategoryField[] = [
  "name",
  "type",
  "defaultDurationHours",
  "maxWindMs",
  "maxRainMmPerHour",
  "minTemperatureC",
  "maxTemperatureC",
  "placeTags",
]

export type CategorySaveOutcome =
  | { kind: "saved"; category: ActivityCategory }
  | { kind: "invalid"; errors: ActivityCategoryFieldErrors }
  | { kind: "conflict" }
  | { kind: "notFound" }
  | { kind: "sessionEnded" }
  | { kind: "forbidden" }

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// Every category, ordered by name. 401 and 403 throw ApiError with that status.
export async function listCategories(
  signal?: AbortSignal,
): Promise<ActivityCategory[]> {
  const response = await apiFetch(basePath, { signal })
  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as ActivityCategory[]
}

// One category, or null when it does not exist (404). 401 and 403 throw ApiError with that status.
export async function getCategory(
  id: string,
  signal?: AbortSignal,
): Promise<ActivityCategory | null> {
  const response = await apiFetch(`${basePath}/${encodeURIComponent(id)}`, {
    signal,
  })
  if (response.status === 404) {
    return null
  }

  if (response.status !== 200) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as ActivityCategory
}

export function createCategory(
  request: ActivityCategoryRequest,
  signal?: AbortSignal,
): Promise<CategorySaveOutcome> {
  return save("POST", basePath, request, signal)
}

// Sends the version the form was opened with, so a change by someone else gives "conflict".
export function updateCategory(
  id: string,
  request: ActivityCategoryRequest,
  version: number,
  signal?: AbortSignal,
): Promise<CategorySaveOutcome> {
  return save(
    "PUT",
    `${basePath}/${encodeURIComponent(id)}`,
    { ...request, version },
    signal,
  )
}

// Throws ApiError for any other status, including a 400 without known field errors,
// and lets network and abort errors through, so callers treat them all as a server error.
async function save(
  method: "POST" | "PUT",
  path: string,
  body: ActivityCategoryRequest & { version?: number },
  signal?: AbortSignal,
): Promise<CategorySaveOutcome> {
  const response = await apiFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  switch (response.status) {
    case 200:
    case 201:
      return {
        kind: "saved",
        category: (await response.json()) as ActivityCategory,
      }
    case 400: {
      const errors = await readFieldErrors(response)
      if (Object.keys(errors).length > 0) {
        return { kind: "invalid", errors }
      }
      break
    }
    case 401:
      return { kind: "sessionEnded" }
    case 403:
      return { kind: "forbidden" }
    case 404:
      return { kind: "notFound" }
    case 409:
      return { kind: "conflict" }
  }

  throw new ApiError(response.status)
}

// The first message for each known field, in form order.
async function readFieldErrors(
  response: Response,
): Promise<ActivityCategoryFieldErrors> {
  const problem = (await response.json()) as ValidationProblem
  const errors: ActivityCategoryFieldErrors = {}
  for (const field of categoryFields) {
    const message = problem.errors?.[field]?.[0]
    if (message) {
      errors[field] = message
    }
  }

  return errors
}
