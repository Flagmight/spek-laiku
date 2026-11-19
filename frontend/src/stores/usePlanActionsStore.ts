import { create } from "zustand"
import { deletePlan } from "../api/savedPlansApi"
import type { DeletePlanAnswer } from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import { useCurrentUserStore } from "./useCurrentUserStore"

export const planDeletedMessage = "Plan deleted."
export const deleteFailedMessage =
  "Error: Plan could not be deleted. Try again."
export const planGoneMessage = "This plan no longer exists."
export const deletingMessage = "Deleting your plan…"

export type PlanActionKind = "delete"

export interface PlanAction {
  kind: PlanActionKind
  planId: string
}

// What an action ended with, for the component that started it: "gone" means the plan no longer exists, and
// "ignored" that another action was still running.
export type PlanActionResult = "deleted" | "gone" | "failed" | "ignored"

// Deleting a saved plan from My plans or the plan page (feature 011 spec FR-001 to FR-003, research section
// 12). One action runs at a time, so one click deletes once. The notice ("Plan deleted.") and the pending
// text are shown in the page's status region; an error is shown with Retry, except for a plan that is gone.
export interface PlanActionsState {
  pending: PlanAction | null
  error: (PlanAction & { message: string }) | null
  notice: string | null
  lastAction: PlanAction | null
  controller: AbortController | null
  deletePlan: (planId: string) => Promise<PlanActionResult>
  // Repeats the last action that failed.
  retry: () => Promise<PlanActionResult>
  // Shows a notice that comes from another page, for example "Plan deleted." after a delete on the plan page.
  showNotice: (notice: string) => void
  reset: () => void
}

export const initialPlanActionsState: Pick<
  PlanActionsState,
  "pending" | "error" | "notice" | "lastAction" | "controller"
> = {
  pending: null,
  error: null,
  notice: null,
  lastAction: null,
  controller: null,
}

// The pending text for the page's status region.
export function pendingMessage(pending: PlanAction | null): string | null {
  return pending ? deletingMessage : null
}

export const usePlanActionsStore = create<PlanActionsState>()((set, get) => {
  async function run(action: PlanAction): Promise<PlanActionResult> {
    if (get().pending) {
      return "ignored"
    }

    const abort = new AbortController()
    set({
      pending: action,
      error: null,
      notice: null,
      lastAction: action,
      controller: abort,
    })
    const clearTimer = startTimeout(abort)
    let answer: DeletePlanAnswer | null = null
    try {
      answer = await deletePlan(action.planId, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a failure.
    } finally {
      clearTimer()
    }

    // After reset() the answer belongs to a closed page, so it is dropped.
    if (get().controller !== abort) {
      return "ignored"
    }

    if (answer?.kind === "deleted") {
      set({ pending: null, controller: null, notice: planDeletedMessage })
      return "deleted"
    }

    if (answer?.kind === "notFound") {
      set({
        pending: null,
        controller: null,
        error: { ...action, message: planGoneMessage },
      })
      return "gone"
    }

    if (answer) {
      // The session ended or the account changed: the guards send the user on after the refresh.
      void useCurrentUserStore.getState().refresh()
    }
    set({
      pending: null,
      controller: null,
      error: { ...action, message: deleteFailedMessage },
    })
    return "failed"
  }

  return {
    ...initialPlanActionsState,
    deletePlan: (planId) => run({ kind: "delete", planId }),
    retry: () => {
      const { lastAction } = get()
      return lastAction ? run(lastAction) : Promise.resolve("ignored")
    },
    showNotice: (notice) => set({ notice, error: null }),
    reset: () => {
      get().controller?.abort()
      set(initialPlanActionsState)
    },
  }
})
