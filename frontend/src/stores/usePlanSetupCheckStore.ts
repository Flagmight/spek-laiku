import { create } from "zustand"
import { checkPlanSetup } from "../api/planSetupApi"
import type { PlanSetupCheckOutcome } from "../api/planSetupApi"
import type {
  PlanSetupCheckRequest,
  PlanSetupFieldErrors,
} from "../types/planSetup"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { usePlanActivitiesStore } from "./usePlanActivitiesStore"
import { usePlanSetupStore } from "./usePlanSetupStore"

// After this long without an answer the check counts as a server error (spec FR-014).
export const planSetupCheckTimeoutMs = 10_000

export type PlanSetupCheckStatus =
  "idle" | "pending" | "invalid" | "serverError" | "tooManyRequests"

export interface PlanSetupCheckState {
  status: PlanSetupCheckStatus
  errors: PlanSetupFieldErrors
  // What was last sent, so Retry sends the same values and dates[i] errors find their date.
  lastRequest: PlanSetupCheckRequest | null
  controller: AbortController | null
  // Resolves true once the server accepted the setup (it is then kept as checked), false otherwise.
  submit: (request: PlanSetupCheckRequest) => Promise<boolean>
  retry: () => Promise<boolean>
  // Aborts a pending check and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialPlanSetupCheckState: Pick<
  PlanSetupCheckState,
  "status" | "errors" | "lastRequest" | "controller"
> = { status: "idle", errors: {}, lastRequest: null, controller: null }

type CheckResult = Pick<PlanSetupCheckState, "status" | "errors">

function toResult(outcome: PlanSetupCheckOutcome | null): CheckResult {
  switch (outcome?.kind) {
    case "checked":
      usePlanSetupStore.getState().setChecked(outcome.setup)
      // The activities stay, but the user has to continue from step 2 again (feature 005, US5 scenario 3).
      usePlanActivitiesStore.getState().clearChecked()
      return { status: "idle", errors: {} }
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "tooManyRequests":
      return { status: "tooManyRequests", errors: {} }
    case "forbidden":
      // The role or status changed: reading the user again lets the page guard show the right page.
      void useCurrentUserStore.getState().refresh()
      return { status: "idle", errors: {} }
    default:
      // A 5xx, a network error or the timeout. Technical details are never shown.
      return { status: "serverError", errors: {} }
  }
}

export const usePlanSetupCheckStore = create<PlanSetupCheckState>()(
  (set, get) => ({
    ...initialPlanSetupCheckState,
    submit: async (request) => {
      // get() reads the current state, so a second click in the same render is still ignored.
      if (get().status === "pending") {
        return false
      }

      const abort = new AbortController()
      set({
        status: "pending",
        errors: {},
        lastRequest: request,
        controller: abort,
      })
      // The fields stay editable while the check runs. An answer for values the user has since
      // changed must not be kept as checked or shown as errors for the new values.
      let setupChanged = false
      const stopWatching = usePlanSetupStore.subscribe((now, before) => {
        if (
          now.location !== before.location ||
          now.dates !== before.dates ||
          now.maxTravelDistanceText !== before.maxTravelDistanceText
        ) {
          setupChanged = true
        }
      })
      const timeout = setTimeout(() => abort.abort(), planSetupCheckTimeoutMs)
      let outcome: PlanSetupCheckOutcome | null = null
      try {
        outcome = await checkPlanSetup(request, abort.signal)
      } catch {
        // A 5xx, a network error or the timeout: outcome stays null, which toResult reports as a
        // server error.
      } finally {
        clearTimeout(timeout)
        stopWatching()
      }

      // After reset() the check belongs to a closed page, so its result is dropped.
      if (get().controller !== abort) {
        return false
      }

      if (setupChanged) {
        set({ status: "idle", errors: {}, controller: null })
        return false
      }

      set({ ...toResult(outcome), controller: null })
      return outcome?.kind === "checked"
    },
    retry: async () => {
      const { lastRequest, submit } = get()
      return lastRequest ? submit(lastRequest) : false
    },
    reset: () => {
      get().controller?.abort()
      set(initialPlanSetupCheckState)
    },
  }),
)
