import type { AccountDeletionAnswer } from "../types/accountDeletion"
import { ApiError, apiFetch } from "./apiClient"

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// Deletes the signed-in user's own account and all their saved plans (feature 016 contracts/account-deletion-api.md).
// The password is sent exactly as entered, only in the body. Each expected status maps to an answer; anything else,
// including a 400 without a password message, throws ApiError. Network and abort errors pass through.
export async function deleteAccount(
  password: string,
  signal?: AbortSignal,
): Promise<AccountDeletionAnswer> {
  const response = await apiFetch("/api/account/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
    signal,
  })
  switch (response.status) {
    case 204:
      return { kind: "deleted" }
    case 400: {
      const problem = (await response.json()) as ValidationProblem
      const message = problem.errors?.password?.[0]
      if (message) {
        return { kind: "invalid", message }
      }

      throw new ApiError(response.status)
    }
    case 401:
      return { kind: "signedOut" }
    case 403:
      return { kind: "forbidden" }
    case 429:
      return { kind: "locked" }
    default:
      throw new ApiError(response.status)
  }
}
