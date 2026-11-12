import { create } from "zustand"
import { getPlanPlaces } from "../api/planPlacesApi"
import type { PlanPlacesOutcome } from "../api/planPlacesApi"
import { checkedPlanRequest } from "../helpers/checkedPlanRequest"
import { startTimeout } from "../helpers/timedRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanPlaces } from "../types/planPlaces"
import type { CheckedPlanSetup } from "../types/planSetup"

export type PlanPlacesStatus =
  | "idle"
  // The first request when step 3 opens; the page shows only its loading message.
  | "loading"
  // A Retry; the rest of step 3 stays in place (spec FR-009).
  | "retrying"
  | "loaded"
  | "mapUnavailable"
  | "tooManyRequests"
  | "serverError"

// The places on step 3 (data-model.md, Plan places store). They are never kept in the session: the page
// asks again each time it opens (spec FR-023), and places are held only while the status is "loaded", so no
// earlier or partial places are ever shown next to an error (spec FR-009).
export interface PlanPlacesState {
  status: PlanPlacesStatus
  places: PlanPlaces | null
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
  // Drops a removed activity from what Retry sends (spec FR-020). The places belong to categories, not
  // activities, so they are kept.
  removeActivity: (id: string) => void
  // Aborts a pending request and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialPlanPlacesState: Pick<
  PlanPlacesState,
  "status" | "places" | "controller" | "lastSetup" | "lastActivities"
> = {
  status: "idle",
  places: null,
  controller: null,
  lastSetup: null,
  lastActivities: null,
}

type Result = Pick<PlanPlacesState, "status" | "places">

function toResult(outcome: PlanPlacesOutcome | null): Result {
  switch (outcome?.kind) {
    case "places":
      return { status: "loaded", places: outcome.places }
    case "mapUnavailable":
      return { status: "mapUnavailable", places: null }
    case "tooManyRequests":
      return { status: "tooManyRequests", places: null }
    default:
      // A 5xx, a network error or the timeout. Technical details are never shown.
      return { status: "serverError", places: null }
  }
}

function isRunning(status: PlanPlacesStatus) {
  return status === "loading" || status === "retrying"
}

export const usePlanPlacesStore = create<PlanPlacesState>()((set, get) => {
  async function request(
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
    status: "loading" | "retrying",
  ) {
    const abort = new AbortController()
    set({
      status,
      places: null,
      controller: abort,
      lastSetup: setup,
      lastActivities: activities,
    })
    const clearTimer = startTimeout(abort)
    let outcome: PlanPlacesOutcome | null = null
    try {
      outcome = await getPlanPlaces(
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

    set({ ...toResult(outcome), controller: null })
  }

  return {
    ...initialPlanPlacesState,
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
      const { lastActivities } = get()
      if (lastActivities?.some((activity) => activity.id === id)) {
        set({
          lastActivities: lastActivities.filter(
            (activity) => activity.id !== id,
          ),
        })
      }
    },
    reset: () => {
      get().controller?.abort()
      set(initialPlanPlacesState)
    },
  }
})
