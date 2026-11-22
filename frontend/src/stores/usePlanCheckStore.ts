import { create } from "zustand"
import { checkPlan } from "../api/planCheckApi"
import type { PlanCheckAnswer } from "../api/planCheckApi"
import { startTimeout } from "../helpers/timedRequest"
import type { PlanCheck } from "../types/planCheck"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { useSavedPlanStore } from "./useSavedPlanStore"

export type PlanCheckStatus =
  | "idle"
  | "checking"
  | "checked"
  | "allPast"
  | "weatherUnavailable"
  | "tooManyRequests"
  | "serverError"

// The check of the open saved plan against the latest forecast (feature 012 data-model.md "usePlanCheckStore").
// One check runs at a time (spec FR-003). A new check clears the previous result, so a failed Recalculate shows
// the plan as saved again (spec FR-013). Never kept: the plan page resets it when it closes.
export interface PlanCheckState {
  status: PlanCheckStatus
  planId: string | null
  // Set only when status is "checked" or "allPast".
  result: PlanCheck | null
  controller: AbortController | null
  // Does nothing while a check is running.
  check: (planId: string) => Promise<void>
  retry: () => Promise<void>
  // Aborts a running check, for example when the page closes; its answer is then ignored.
  reset: () => void
}

export const initialPlanCheckState: Pick<
  PlanCheckState,
  "status" | "planId" | "result" | "controller"
> = { status: "idle", planId: null, result: null, controller: null }

type Result = Pick<PlanCheckState, "status" | "result">

function toResult(answer: PlanCheckAnswer | null): Result {
  switch (answer?.kind) {
    case "check":
      return {
        status: answer.check.status === "allPast" ? "allPast" : "checked",
        result: answer.check,
      }
    case "weatherUnavailable":
    case "tooManyRequests":
      return { status: answer.kind, result: null }
    case "notFound":
      // The plan was deleted after it loaded: the page says it no longer exists.
      useSavedPlanStore.getState().markGone()
      return { status: "idle", result: null }
    case "unauthorized":
    case "forbidden":
      // The account's state changed: the route guards show Log in, Access denied or Account Suspended.
      void useCurrentUserStore.getState().refresh()
      return { status: "idle", result: null }
    default:
      return { status: "serverError", result: null }
  }
}

export const usePlanCheckStore = create<PlanCheckState>()((set, get) => ({
  ...initialPlanCheckState,
  check: async (planId) => {
    if (get().status === "checking") {
      return
    }

    const abort = new AbortController()
    set({ status: "checking", planId, result: null, controller: abort })
    const clearTimer = startTimeout(abort)
    let answer: PlanCheckAnswer | null = null
    try {
      answer = await checkPlan(planId, abort.signal)
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the answer belongs to nobody, so it is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(answer), controller: null })
  },
  retry: async () => {
    const { planId, check } = get()
    if (planId) {
      await check(planId)
    }
  },
  reset: () => {
    get().controller?.abort()
    set(initialPlanCheckState)
  },
}))
