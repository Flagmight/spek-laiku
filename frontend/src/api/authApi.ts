import type { CurrentUser } from "../types/currentUser"
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
