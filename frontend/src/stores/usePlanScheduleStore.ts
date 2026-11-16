import { create } from "zustand"
import { getPlanSchedule } from "../api/planScheduleApi"
import type { PlanScheduleAnswer } from "../api/planScheduleApi"
import { checkedPlanRequest } from "../helpers/checkedPlanRequest"
import { startTimeout } from "../helpers/timedRequest"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { CheckedPlanSetup } from "../types/planSetup"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { usePlanActivitiesStore } from "./usePlanActivitiesStore"
import { usePlanSetupStore } from "./usePlanSetupStore"

export type PlanScheduleStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "weatherUnavailable"
  | "placesUnavailable"
  | "tooManyRequests"
  | "serverError"
  // The server found the setup or the activities out of date; the page's guards send the user back.
  | "setupOutdated"
  | "activitiesOutdated"

// The schedule on step 4. Generated on demand; never persisted.
export interface PlanScheduleState {
  status: PlanScheduleStatus
  schedule: PlanSchedule | null
  controller: AbortController | null
  lastSetup: CheckedPlanSetup | null
  lastActivities: CheckedPlanActivity[] | null
  // No-op while loading; aborts any previous request and starts a fresh one.
  generate: (setup: CheckedPlanSetup, activities: CheckedPlanActivity[]) => Promise<void>
  // Re-runs the last generate (always fires, even from an error state). No-op while loading.
  retry: () => Promise<void>
  // Aborts a pending request and returns to idle, for example when the page closes (spec FR-014).
  reset: () => void
}

export const initialPlanScheduleState: Pick<
  PlanScheduleState,
  "status" | "schedule" | "controller" | "lastSetup" | "lastActivities"
> = {
  status: "idle",
  schedule: null,
  controller: null,
  lastSetup: null,
  lastActivities: null,
}

type Result = Pick<PlanScheduleState, "status" | "schedule">

function toResult(answer: PlanScheduleAnswer | null): Result {
  switch (answer?.kind) {
    case "schedule":
      return { status: "loaded", schedule: answer.schedule }
    case "setupOutdated":
      usePlanSetupStore.getState().markOutdated()
      return { status: "setupOutdated", schedule: null }
    case "activitiesOutdated":
      usePlanActivitiesStore.getState().markOutdated()
      return { status: "activitiesOutdated", schedule: null }
    case "forbidden":
      void useCurrentUserStore.getState().refresh()
      return { status: "serverError", schedule: null }
    case "weatherUnavailable":
      return { status: "weatherUnavailable", schedule: null }
    case "placesUnavailable":
      return { status: "placesUnavailable", schedule: null }
    case "tooManyRequests":
      return { status: "tooManyRequests", schedule: null }
    default:
      return { status: "serverError", schedule: null }
  }
}

export const usePlanScheduleStore = create<PlanScheduleState>()((set, get) => {
  async function request(
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
  ) {
    const abort = new AbortController()
    get().controller?.abort()
    set({
      status: "loading",
      schedule: null,
      controller: abort,
      lastSetup: setup,
      lastActivities: activities,
    })
    const clearTimer = startTimeout(abort)
    let answer: PlanScheduleAnswer | null = null
    try {
      answer = await getPlanSchedule(
        checkedPlanRequest(setup, activities),
        abort.signal,
      )
    } catch {
      // A 5xx, a network error, the timeout or an abort: answer stays null, which is a server error.
    } finally {
      clearTimer()
    }

    // After reset() the request belongs to a closed page, so its answer is dropped.
    if (get().controller !== abort) {
      return
    }

    set({ ...toResult(answer), controller: null })
  }

  return {
    ...initialPlanScheduleState,
    generate: async (setup, activities) => {
      if (get().status === "loading") {
        return
      }
      await request(setup, activities)
    },
    retry: async () => {
      const { lastSetup, lastActivities, status } = get()
      if (lastSetup && lastActivities && status !== "loading") {
        await request(lastSetup, lastActivities)
      }
    },
    reset: () => {
      get().controller?.abort()
      set(initialPlanScheduleState)
    },
  }
})
