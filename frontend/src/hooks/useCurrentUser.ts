import { createContext, useContext } from "react"
import type { CurrentUser } from "../types/currentUser"

export interface CurrentUserState {
  status: "loading" | "signedIn" | "signedOut" | "error"
  user: CurrentUser | null
  refresh: () => Promise<void>
}

export const CurrentUserContext = createContext<CurrentUserState | null>(null)

// Shared signed-in state from GET /api/auth/me, provided by CurrentUserProvider.
export function useCurrentUser(): CurrentUserState {
  const state = useContext(CurrentUserContext)
  if (!state) {
    throw new Error("useCurrentUser must be used inside CurrentUserProvider.")
  }

  return state
}
