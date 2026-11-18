import { create } from "zustand"
import { getSavedPlan } from "../api/savedPlansApi"
import type { SavedPlanAnswer } from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import type { SavedPlan } from "../types/savedPlan"
import { useCurrentUserStore } from "./useCurrentUserStore"

export type SavedPlanStatus =
  "loading" | "loaded" | "notFound" | "forbidden" | "serverError"

// One saved plan for the plan page (feature 010 spec User Story 4). Loaded each time the page opens; never kept.
export interface SavedPlanState {
  status: SavedPlanStatus
  plan: SavedPlan | null
  planId: string | null
  controller: AbortController | null
  // Aborts any earlier request and loads this plan.
  load: (id: string) => Promise<void>
  retry: () => Promise<void>
  // Aborts a pending request, for example when the page closes.
  reset: () => void
}

export const initialSavedPlanState: Pick<
  SavedPlanState,
  "status" | "plan" | "planId" | "controller"
> = { status: "loading", plan: null, planId: null, controller: null }

type Result = Pick<SavedPlanState, "status" | "plan">

function toResult(answer: SavedPlanAnswer | null): Result {
  switch (answer?.kind) {
    case "plan":
      return { status: "loaded", plan: answer.plan }
    case "notFound":
      return { status: "notFound", plan: null }
    case "forbidden":
      return { status: "forbidden", plan: null }
    case "unauthorized":
      // The session ended: SignedInOnly sends the user to Log in after the refresh.
      void useCurrentUserStore.getState().refresh()
      return { status: "serverError", plan: null }
    default:
      return { status: "serverError", plan: null }
  }
}

export const useSavedPlanStore = create<SavedPlanState>()((set, get) => ({
  ...initialSavedPlanState,
  load: async (id) => {
    const abort = new AbortController()
    get().controller?.abort()
    set({ status: "loading", plan: null, planId: id, controller: abort })
    const clearTimer = startTimeout(abort)
    let answer: SavedPlanAnswer | null = null
    try {
      answer = await getSavedPlan(id, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() or a newer load the answer belongs to nobody, so it is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(answer), controller: null })
  },
  retry: async () => {
    const { planId, load } = get()
    if (planId) {
      await load(planId)
    }
  },
  reset: () => {
    get().controller?.abort()
    set(initialSavedPlanState)
  },
}))
