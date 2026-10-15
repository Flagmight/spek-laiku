import type {
  RegistrationField,
  RegistrationFieldErrors,
  RegistrationRequest,
} from "../types/registration"
import { ApiError, apiFetch } from "./apiClient"

export type RegistrationOutcome =
  | { kind: "created" }
  | { kind: "invalid"; errors: RegistrationFieldErrors }
  | { kind: "alreadySignedIn" }

const fields: RegistrationField[] = [
  "email",
  "password",
  "passwordConfirmation",
]

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// Throws ApiError for any other status, including a 400 without field errors,
// and lets network and abort errors through, so callers treat them all as a server error.
export async function register(
  request: RegistrationRequest,
  signal?: AbortSignal,
): Promise<RegistrationOutcome> {
  const response = await apiFetch("/api/registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  if (response.status === 201) {
    return { kind: "created" }
  }

  if (response.status === 403) {
    return { kind: "alreadySignedIn" }
  }

  if (response.status === 400) {
    const problem = (await response.json()) as ValidationProblem
    const errors: RegistrationFieldErrors = {}
    for (const field of fields) {
      const message = problem.errors?.[field]?.[0]
      if (message) {
        errors[field] = message
      }
    }

    if (Object.keys(errors).length > 0) {
      return { kind: "invalid", errors }
    }
  }

  throw new ApiError(response.status)
}
