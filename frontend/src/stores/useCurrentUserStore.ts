import { create } from "zustand"
import { getCurrentUser } from "../api/authApi"
import type { CurrentUser } from "../types/currentUser"

export interface CurrentUserState {
  status: "loading" | "signedIn" | "signedOut" | "error"
  user: CurrentUser | null
  // True when a signed-in session ended without logging out, so login can say it expired (FR-020).
  sessionExpired: boolean
  refresh: () => Promise<void>
  setSignedIn: (user: CurrentUser) => void
  setSignedOut: () => void
  markSessionEnded: () => void
}

export const initialCurrentUserState: Pick<
  CurrentUserState,
  "status" | "user" | "sessionExpired"
> = { status: "loading", user: null, sessionExpired: false }

// Only the most recent request or action may update the state.
let latestRequest = 0

// Shared signed-in state from GET /api/auth/me. main.tsx starts the first load.
export const useCurrentUserStore = create<CurrentUserState>()((set, get) => ({
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
      if (get().status === "signedIn" && loaded.status === "signedOut") {
        set({ ...loaded, sessionExpired: true })
      } else {
        set(loaded)
      }
    }
  },
  setSignedIn: (user) => {
    latestRequest++
    set({ status: "signedIn", user, sessionExpired: false })
  },
  setSignedOut: () => {
    latestRequest++
    set({ status: "signedOut", user: null, sessionExpired: false })
  },
  markSessionEnded: () => {
    latestRequest++
    if (get().status === "signedIn") {
      set({ status: "signedOut", user: null, sessionExpired: true })
    } else {
      set({ status: "signedOut", user: null })
    }
  },
}))
