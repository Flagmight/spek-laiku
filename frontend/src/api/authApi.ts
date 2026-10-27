import type { CurrentUser } from "../types/currentUser"
import type { LoginField, LoginFieldErrors, LoginRequest } from "../types/login"
import { ApiError, apiFetch } from "./apiClient"

// Returns null when nobody is signed in (401).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await apiFetch("/api/auth/me")
  if (response.status === 401) {
    return null
  }

  if (!response.ok) {
    throw new ApiError(response.status)
  }

  return (await response.json()) as CurrentUser
}

export type LoginOutcome =
  | { kind: "signedIn"; user: CurrentUser }
  | { kind: "invalid"; errors: LoginFieldErrors }
  | { kind: "incorrect" }
  | { kind: "alreadySignedIn" }

const loginFields: LoginField[] = ["email", "password"]

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// Throws ApiError for any other status, including a 400 without field errors,
// and lets network and abort errors through, so callers treat them all as a server error.
export async function login(
  request: LoginRequest,
  signal?: AbortSignal,
): Promise<LoginOutcome> {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  })

  if (response.status === 200) {
    return { kind: "signedIn", user: (await response.json()) as CurrentUser }
  }

  if (response.status === 401) {
    return { kind: "incorrect" }
  }

  if (response.status === 403) {
    return { kind: "alreadySignedIn" }
  }

  if (response.status === 400) {
    const problem = (await response.json()) as ValidationProblem
    const errors: LoginFieldErrors = {}
    for (const field of loginFields) {
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

// Ends the session. The server answers 204 whether or not there was one (FR-017); anything
// else throws ApiError, and network and abort errors pass through.
export async function logout(signal?: AbortSignal): Promise<void> {
  const response = await apiFetch("/api/auth/logout", {
    method: "POST",
    signal,
  })
  if (response.status !== 204) {
    throw new ApiError(response.status)
  }
}
