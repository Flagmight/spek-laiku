import { create } from "zustand"
import { logout } from "../api/authApi"
import { useAccountStatusStore } from "./useAccountStatusStore"
import { useAdminAccountsStore } from "./useAdminAccountsStore"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { useKeptScheduleStore } from "./useKeptScheduleStore"
import { usePlanActivitiesStore } from "./usePlanActivitiesStore"
import { usePlanEditStore } from "./usePlanEditStore"
import { usePlanSetupStore } from "./usePlanSetupStore"

// After this long without an answer the request counts as a server error (FR-014).
export const logoutTimeoutMs = 10_000

export type LogoutStatus = "idle" | "pending" | "serverError"

export interface LogoutState {
  status: LogoutStatus
  controller: AbortController | null
  // Resolves true once the user is signed out, false on failure or when ignored or reset.
  submit: () => Promise<boolean>
  retry: () => Promise<boolean>
  // Aborts a pending request and starts again from idle.
  reset: () => void
}

export const initialLogoutState: Pick<LogoutState, "status" | "controller"> = {
  status: "idle",
  controller: null,
}

export const useLogoutStore = create<LogoutState>()((set, get) => ({
  ...initialLogoutState,
  submit: async () => {
    // get() reads the current state, so a second click in the same render is still ignored.
    if (get().status === "pending") {
      return false
    }

    const abort = new AbortController()
    set({ status: "pending", controller: abort })
    const timeout = setTimeout(() => abort.abort(), logoutTimeoutMs)
    let succeeded = false
    try {
      await logout(abort.signal)
      succeeded = true
    } catch {
      // A 5xx, a network error or the timeout (FR-014). The user stays signed in.
    } finally {
      clearTimeout(timeout)
    }

    // After reset() the result belongs to nobody, so it is dropped.
    if (get().controller !== abort) {
      return false
    }

    if (succeeded) {
      // Signed out on purpose, so a protected page later says "Log in to continue.", not expired.
      useCurrentUserStore.getState().setSignedOut()
      // The plan in progress belongs to the session that ended (feature 004, spec FR-017).
      usePlanSetupStore.getState().clear()
      // The activities go with it (feature 005, spec FR-019).
      usePlanActivitiesStore.getState().clear()
      // And a schedule kept for saving after login (feature 010, spec FR-007).
      useKeptScheduleStore.getState().clear()
      // And an edit of a saved plan with the saved marker (feature 011, spec FR-013).
      usePlanEditStore.getState().clearAll()
      // And the administrator's account list and any status change in progress (feature 014).
      useAdminAccountsStore.getState().reset()
      useAccountStatusStore.getState().reset()
    }

    set({ status: succeeded ? "idle" : "serverError", controller: null })
    return succeeded
  },
  retry: () => get().submit(),
  reset: () => {
    get().controller?.abort()
    set(initialLogoutState)
  },
}))
