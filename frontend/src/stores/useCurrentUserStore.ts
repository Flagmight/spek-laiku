import { create } from "zustand"
import { getCurrentUser } from "../api/authApi"
import type { CurrentUser } from "../types/currentUser"

export interface CurrentUserState {
  status: "loading" | "signedIn" | "signedOut" | "error"
  user: CurrentUser | null
  refresh: () => Promise<void>
}

export const initialCurrentUserState: Pick<
  CurrentUserState,
  "status" | "user"
> = { status: "loading", user: null }

// Only the most recent request may update the state.
let latestRequest = 0

// Shared signed-in state from GET /api/auth/me. main.tsx starts the first load.
export const useCurrentUserStore = create<CurrentUserState>()((set) => ({
  ...initialCurrentUserState,
  refresh: async () => {
    const request = ++latestRequest
    let loaded: Pick<CurrentUserState, "status" | "user">
    try {
      const user = await getCurrentUser()
      loaded = { status: user ? "signedIn" : "signedOut", user }
    } catch {
      loaded = { status: "error", user: null }
    }

    if (request === latestRequest) {
      set(loaded)
    }
  },
}))
