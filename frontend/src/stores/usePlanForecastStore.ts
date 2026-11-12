import { create } from "zustand"
import { getPlanForecast } from "../api/planForecastApi"
import type { PlanForecastOutcome } from "../api/planForecastApi"
import { checkedPlanRequest } from "../helpers/checkedPlanRequest"
import { startTimeout } from "../helpers/timedRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanForecast } from "../types/planForecast"
import type { CheckedPlanSetup } from "../types/planSetup"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { usePlanActivitiesStore } from "./usePlanActivitiesStore"
import { usePlanSetupStore } from "./usePlanSetupStore"

export type PlanForecastStatus =
  | "idle"
  // The first request when step 3 opens; the page shows only its loading message.
  | "loading"
  // A Retry; the rest of step 3 stays in place (feature 007 FR-016).
  | "retrying"
  | "loaded"
  | "weatherUnavailable"
  | "tooManyRequests"
  | "serverError"
  // The server found the setup or the activities out of date; the page's guards send the user back.
  | "setupOutdated"
  | "activitiesOutdated"

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
  // Ignored while a request (a load or a Retry) runs, so only one runs at a time.
  load: (
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
  ) => Promise<void>
  // Asks again for the last setup and activities, with the status "retrying". Also ignored while one runs.
  retry: () => Promise<void>
  // Drops a removed activity from the forecast and from what Retry sends (feature 007 FR-020). The forecast
  // lines up with lastActivities by position, so both lose the same entry; nothing is asked again.
  removeActivity: (id: string) => void
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
    case "setupOutdated":
      // Unchecking the setup makes step 3 send the user to Plan setup, which shows the notice (spec FR-005).
      usePlanSetupStore.getState().markOutdated()
      return { status: "setupOutdated", forecast: null }
    case "activitiesOutdated":
      usePlanActivitiesStore.getState().markOutdated()
      return { status: "activitiesOutdated", forecast: null }
    case "forbidden":
      // The role or status changed: reading the user again lets the page guard show the right page. Until
      // it does, or if that fails, the page shows the server error with Retry instead of an empty step.
      void useCurrentUserStore.getState().refresh()
      return { status: "serverError", forecast: null }
    case "weatherUnavailable":
      return { status: "weatherUnavailable", forecast: null }
    case "tooManyRequests":
      return { status: "tooManyRequests", forecast: null }
    default:
      // A 5xx, a network error or the timeout. Technical details are never shown.
      return { status: "serverError", forecast: null }
  }
}

function isRunning(status: PlanForecastStatus) {
  return status === "loading" || status === "retrying"
}

export const usePlanForecastStore = create<PlanForecastState>()((set, get) => {
  async function request(
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
    status: "loading" | "retrying",
  ) {
    const abort = new AbortController()
    set({
      status,
      forecast: null,
      controller: abort,
      lastSetup: setup,
      lastActivities: activities,
    })
    const clearTimer = startTimeout(abort)
    let outcome: PlanForecastOutcome | null = null
    try {
      outcome = await getPlanForecast(
        checkedPlanRequest(setup, activities),
        abort.signal,
      )
    } catch {
      // A 5xx, a network error, the timeout or an abort: outcome stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(withoutRemoved(outcome, activities)), controller: null })
  }

  // An activity removed on step 3 while the request ran (feature 007 FR-020) is still in the answer, which
  // lines up with the activities that were sent. Its entry is dropped, so the forecast lines up with the
  // activities that are left, without asking again.
  function withoutRemoved(
    outcome: PlanForecastOutcome | null,
    sent: CheckedPlanActivity[],
  ): PlanForecastOutcome | null {
    if (outcome?.kind !== "forecast") {
      return outcome
    }

    const kept = new Set(get().lastActivities?.map((activity) => activity.id))
    return {
      ...outcome,
      forecast: {
        ...outcome.forecast,
        activities: outcome.forecast.activities.filter((_, index) =>
          kept.has(sent[index]?.id),
        ),
      },
    }
  }

  return {
    ...initialPlanForecastState,
    load: async (setup, activities) => {
      // get() reads the current state, so a second call in the same render is still ignored.
      if (isRunning(get().status)) {
        return
      }

      await request(setup, activities, "loading")
    },
    retry: async () => {
      const { lastSetup, lastActivities, status } = get()
      if (lastSetup && lastActivities && !isRunning(status)) {
        await request(lastSetup, lastActivities, "retrying")
      }
    },
    removeActivity: (id) => {
      const { forecast, lastActivities } = get()
      const index =
        lastActivities?.findIndex((activity) => activity.id === id) ?? -1
      if (!lastActivities || index < 0) {
        return
      }

      set({
        lastActivities: lastActivities.filter((_, at) => at !== index),
        forecast: forecast && {
          ...forecast,
          activities: forecast.activities.filter((_, at) => at !== index),
        },
      })
    },
    reset: () => {
      get().controller?.abort()
      set(initialPlanForecastState)
    },
  }
})
