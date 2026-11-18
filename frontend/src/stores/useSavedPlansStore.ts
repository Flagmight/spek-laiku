import { create } from "zustand"
import { getSavedPlans } from "../api/savedPlansApi"
import type { SavedPlansAnswer } from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import type { SavedPlanSummary } from "../types/savedPlan"
import { useCurrentUserStore } from "./useCurrentUserStore"

export type SavedPlansStatus = "loading" | "loaded" | "serverError"

// The signed-in user's saved plans, for My plans and the Home block (feature 010 spec FR-009, FR-011,
// research section 11). Loaded each time one of them opens; never kept.
export interface SavedPlansState {
  status: SavedPlansStatus
  plans: SavedPlanSummary[]
  controller: AbortController | null
  // Aborts any earlier request and loads again.
  load: () => Promise<void>
  retry: () => Promise<void>
  // Aborts a pending request, for example when the page closes.
  reset: () => void
}

export const initialSavedPlansState: Pick<
  SavedPlansState,
  "status" | "plans" | "controller"
> = { status: "loading", plans: [], controller: null }

export const useSavedPlansStore = create<SavedPlansState>()((set, get) => ({
  ...initialSavedPlansState,
  load: async () => {
    const abort = new AbortController()
    get().controller?.abort()
    set({ status: "loading", controller: abort })
    const clearTimer = startTimeout(abort)
    let answer: SavedPlansAnswer | null = null
    try {
      answer = await getSavedPlans(abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() or a newer load the answer belongs to nobody, so it is dropped.
    if (get().controller !== abort) {
      return
    }

    if (answer?.kind === "plans") {
      set({ status: "loaded", plans: answer.plans, controller: null })
      return
    }

    if (answer) {
      // The session ended or the account changed: the guards send the user on after the refresh.
      void useCurrentUserStore.getState().refresh()
    }
    set({ status: "serverError", plans: [], controller: null })
  },
  retry: () => get().load(),
  reset: () => {
    get().controller?.abort()
    set(initialSavedPlansState)
  },
}))
