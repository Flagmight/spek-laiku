import { create } from "zustand"
import { deletePlan, duplicatePlan } from "../api/savedPlansApi"
import type {
  DeletePlanAnswer,
  DuplicatePlanAnswer,
} from "../api/savedPlansApi"
import { startTimeout } from "../helpers/timedRequest"
import type { SavedPlanSummary } from "../types/savedPlan"
import { useCurrentUserStore } from "./useCurrentUserStore"

export const planDeletedMessage = "Plan deleted."
export const deleteFailedMessage =
  "Error: Plan could not be deleted. Try again."
export const deletingMessage = "Deleting your plan…"
export const planDuplicatedMessage = "Plan duplicated."
export const duplicateFailedMessage =
  "Error: Plan could not be duplicated. Try again."
export const duplicatingMessage = "Duplicating your plan…"
export const planGoneMessage = "This plan no longer exists."

export type PlanActionKind = "delete" | "duplicate"

export interface PlanAction {
  kind: PlanActionKind
  planId: string
}

// What an action ended with: "gone" means the plan no longer exists, and "ignored" that another action was
// still running or the page closed. A duplicate that succeeded carries the copy.
export type PlanActionResult =
  "deleted" | "gone" | "failed" | "ignored" | { copy: SavedPlanSummary }

// Called with the result of an action, also when Retry repeats it, so the page removes a deleted row or shows
// a copy however the action finally succeeded.
export type PlanActionHandler = (result: PlanActionResult) => void

const messages: Record<
  PlanActionKind,
  { pending: string; done: string; failed: string }
> = {
  delete: {
    pending: deletingMessage,
    done: planDeletedMessage,
    failed: deleteFailedMessage,
  },
  duplicate: {
    pending: duplicatingMessage,
    done: planDuplicatedMessage,
    failed: duplicateFailedMessage,
  },
}

// Deleting and duplicating a saved plan from My plans or the plan page (feature 011 spec FR-001 to FR-006,
// research section 12). One action runs at a time, so one click deletes or copies once. The notice and the
// pending text are shown in the page's status region; an error is shown with Retry, except for a plan that is
// gone.
export interface PlanActionsState {
  pending: PlanAction | null
  error: (PlanAction & { message: string }) | null
  notice: string | null
  lastAction: { action: PlanAction; onResult?: PlanActionHandler } | null
  controller: AbortController | null
  deletePlan: (
    planId: string,
    onResult?: PlanActionHandler,
  ) => Promise<PlanActionResult>
  duplicatePlan: (
    planId: string,
    onResult?: PlanActionHandler,
  ) => Promise<PlanActionResult>
  // Repeats the last action, with the same result handler.
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
  return pending ? messages[pending.kind].pending : null
}

type Answer = DeletePlanAnswer | DuplicatePlanAnswer

function send(action: PlanAction, signal: AbortSignal): Promise<Answer> {
  return action.kind === "delete"
    ? deletePlan(action.planId, signal)
    : duplicatePlan(action.planId, signal)
}

export const usePlanActionsStore = create<PlanActionsState>()((set, get) => {
  async function run(
    action: PlanAction,
    onResult?: PlanActionHandler,
  ): Promise<PlanActionResult> {
    if (get().pending) {
      return "ignored"
    }

    const abort = new AbortController()
    set({
      pending: action,
      error: null,
      notice: null,
      lastAction: { action, onResult },
      controller: abort,
    })
    const clearTimer = startTimeout(abort)
    let answer: Answer | null = null
    try {
      answer = await send(action, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a failure.
    } finally {
      clearTimer()
    }

    // After reset() the answer belongs to a closed page, so it is dropped.
    if (get().controller !== abort) {
      return "ignored"
    }

    const result = settle(action, answer)
    onResult?.(result)
    return result
  }

  function settle(action: PlanAction, answer: Answer | null): PlanActionResult {
    const done = { pending: null, controller: null }
    if (answer?.kind === "deleted" || answer?.kind === "duplicated") {
      set({ ...done, notice: messages[action.kind].done })
      return answer.kind === "deleted" ? "deleted" : { copy: answer.plan }
    }

    if (answer?.kind === "notFound") {
      set({ ...done, error: { ...action, message: planGoneMessage } })
      return "gone"
    }

    if (answer) {
      // The session ended or the account changed: the guards send the user on after the refresh.
      void useCurrentUserStore.getState().refresh()
    }
    set({
      ...done,
      error: { ...action, message: messages[action.kind].failed },
    })
    return "failed"
  }

  return {
    ...initialPlanActionsState,
    deletePlan: (planId, onResult) => run({ kind: "delete", planId }, onResult),
    duplicatePlan: (planId, onResult) =>
      run({ kind: "duplicate", planId }, onResult),
    retry: () => {
      const { lastAction } = get()
      return lastAction
        ? run(lastAction.action, lastAction.onResult)
        : Promise.resolve("ignored")
    },
    showNotice: (notice) => set({ notice, error: null }),
    reset: () => {
      get().controller?.abort()
      set(initialPlanActionsState)
    },
  }
})
