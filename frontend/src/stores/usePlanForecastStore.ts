import { create } from "zustand"
import { getPlanForecast } from "../api/planForecastApi"
import type { PlanForecastOutcome } from "../api/planForecastApi"
import { planForecastRequest } from "../helpers/planForecastRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { CheckedPlanSetup } from "../types/planSetup"

export type PlanForecastStatus = "idle" | "loading" | "loaded" | "serverError"

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
    let outcome: PlanForecastOutcome | null = null
    try {
      outcome = await getPlanForecast(
        planForecastRequest(setup, activities),
        abort.signal,
      )
    } catch {
      // A 5xx, a network error or an abort: outcome stays null, which is a server error.
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    set(
      outcome?.kind === "forecast"
        ? { status: "loaded", forecast: outcome.forecast, controller: null }
        : { status: "serverError", forecast: null, controller: null },
    )
  },
  reset: () => {
    get().controller?.abort()
    set(initialPlanForecastState)
  },
}))
