import { create } from "zustand"
import { getPlanForecast } from "../api/planForecastApi"
import type { PlanForecastOutcome } from "../api/planForecastApi"
import { planForecastRequest } from "../helpers/planForecastRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { CheckedPlanSetup } from "../types/planSetup"

// After this long without an answer the request counts as a server error (spec FR-006).
export const planForecastTimeoutMs = 10_000

export type PlanForecastStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "weatherUnavailable"
  | "tooManyRequests"
  | "serverError"

// The forecast on step 3 (data-model.md, Plan forecast store). It is never kept in the session: the page
// asks again each time it opens (spec FR-025), and a forecast is held only while its status is "loaded",
// so no earlier forecast is ever shown next to an error (spec FR-006).
export interface PlanForecastState {
  status: PlanForecastStatus
  forecast: PlanForecast | null
  controller: AbortController | null
  // What was last asked for, so Retry sends the same plan.
  lastSetup: CheckedPlanSetup | null
  lastActivities: CheckedPlanActivity[] | null
  // Ignored while a request runs, so only one runs at a time.
  load: (
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
  ) => Promise<void>
  // Asks again for the last setup and activities.
  retry: () => Promise<void>
  // Aborts a pending request and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialPlanForecastState: Pick<
  PlanForecastState,
  "status" | "forecast" | "controller" | "lastSetup" | "lastActivities"
> = {
  status: "idle",
  forecast: null,
  controller: null,
  lastSetup: null,
  lastActivities: null,
}

type Result = Pick<PlanForecastState, "status" | "forecast">

function toResult(outcome: PlanForecastOutcome | null): Result {
  switch (outcome?.kind) {
    case "forecast":
      return { status: "loaded", forecast: outcome.forecast }
    case "weatherUnavailable":
      return { status: "weatherUnavailable", forecast: null }
    case "tooManyRequests":
      return { status: "tooManyRequests", forecast: null }
    default:
      // A 5xx, a network error or the timeout. Technical details are never shown.
      return { status: "serverError", forecast: null }
  }
}

export const usePlanForecastStore = create<PlanForecastState>()((set, get) => ({
  ...initialPlanForecastState,
  load: async (setup, activities) => {
    // get() reads the current state, so a second call in the same render is still ignored.
    if (get().status === "loading") {
      return
    }

    const abort = new AbortController()
    set({
      status: "loading",
      forecast: null,
      controller: abort,
      lastSetup: setup,
      lastActivities: activities,
    })
    const timeout = setTimeout(() => abort.abort(), planForecastTimeoutMs)
    let outcome: PlanForecastOutcome | null = null
    try {
      outcome = await getPlanForecast(
        planForecastRequest(setup, activities),
        abort.signal,
      )
    } catch {
      // A 5xx, a network error, the timeout or an abort: outcome stays null, which is a server error.
    } finally {
      clearTimeout(timeout)
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(outcome), controller: null })
  },
  retry: async () => {
    const { lastSetup, lastActivities, load } = get()
    if (lastSetup && lastActivities) {
      await load(lastSetup, lastActivities)
    }
  },
  reset: () => {
    get().controller?.abort()
    set(initialPlanForecastState)
  },
}))
