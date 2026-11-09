import { create } from "zustand"
import { checkPlanActivities } from "../api/planActivitiesApi"
import type { PlanActivitiesCheckOutcome } from "../api/planActivitiesApi"
import { planActivitiesRequest } from "../helpers/planActivityRequest"
import type {
  PlanActivity,
  PlanActivityErrors,
  PlanActivityField,
} from "../types/planActivity"
import { useCurrentUserStore } from "./useCurrentUserStore"
import { usePlanActivitiesStore } from "./usePlanActivitiesStore"

// After this long without an answer the check counts as a server error (spec FR-015).
export const planActivitiesCheckTimeoutMs = 10_000

export interface PlanActivitiesCheckState {
  status: "idle" | "pending" | "invalid" | "serverError"
  errors: PlanActivityErrors
  // What was last sent, with the browser's ids, so Retry sends the same activities.
  lastRequest: PlanActivity[] | null
  controller: AbortController | null
  // Resolves true once the server accepted the activities (they are then kept as checked).
  submit: (activities: PlanActivity[]) => Promise<boolean>
  retry: () => Promise<boolean>
  // Aborts a pending check and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialPlanActivitiesCheckState: Pick<
  PlanActivitiesCheckState,
  "status" | "errors" | "lastRequest" | "controller"
> = {
  status: "idle",
  errors: { byActivity: {} },
  lastRequest: null,
  controller: null,
}

type CheckResult = Pick<PlanActivitiesCheckState, "status" | "errors">

const noErrors: PlanActivityErrors = { byActivity: {} }

// The server answers by position; ids keep each message on its activity after another is removed.
const activityKey = /^activities\[(\d+)\](?:\.(\w+))?$/

function toErrors(
  serverErrors: Record<string, string>,
  sent: PlanActivity[],
): PlanActivityErrors {
  const errors: PlanActivityErrors = {
    list: serverErrors.activities,
    byActivity: {},
  }
  for (const [key, message] of Object.entries(serverErrors)) {
    const match = activityKey.exec(key)
    const id = match ? sent[Number(match[1])]?.id : undefined
    if (match && id) {
      const field = (match[2] ?? "activity") as PlanActivityField
      errors.byActivity[id] = { ...errors.byActivity[id], [field]: message }
    }
  }

  return errors
}

function toResult(
  outcome: PlanActivitiesCheckOutcome | null,
  sent: PlanActivity[],
): CheckResult {
  switch (outcome?.kind) {
    case "checked":
      usePlanActivitiesStore.getState().setChecked(
        outcome.activities.map((activity, index) => ({
          ...activity,
          id: sent[index].id,
        })),
      )
      return { status: "idle", errors: noErrors }
    case "invalid":
      return { status: "invalid", errors: toErrors(outcome.errors, sent) }
    case "forbidden":
      // The role or status changed: reading the user again lets the page guard show the right page.
      void useCurrentUserStore.getState().refresh()
      return { status: "idle", errors: noErrors }
    default:
      // A 5xx, a network error or the timeout. Technical details are never shown.
      return { status: "serverError", errors: noErrors }
  }
}

export const usePlanActivitiesCheckStore = create<PlanActivitiesCheckState>()(
  (set, get) => ({
    ...initialPlanActivitiesCheckState,
    submit: async (activities) => {
      // get() reads the current state, so a second click in the same render is still ignored.
      if (get().status === "pending") {
        return false
      }

      const abort = new AbortController()
      set({
        status: "pending",
        errors: noErrors,
        lastRequest: activities,
        controller: abort,
      })
      // The fields stay editable while the check runs. An answer for activities the user has since
      // changed must not be kept as checked or shown as errors for the new values (spec FR-015).
      let activitiesChanged = false
      const stopWatching = usePlanActivitiesStore.subscribe((now, before) => {
        if (now.activities !== before.activities) {
          activitiesChanged = true
        }
      })
      const timeout = setTimeout(
        () => abort.abort(),
        planActivitiesCheckTimeoutMs,
      )
      let outcome: PlanActivitiesCheckOutcome | null = null
      try {
        outcome = await checkPlanActivities(
          planActivitiesRequest(activities),
          abort.signal,
        )
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

      if (activitiesChanged) {
        set({ status: "idle", errors: noErrors, controller: null })
        return false
      }

      set({ ...toResult(outcome, activities), controller: null })
      return outcome?.kind === "checked"
    },
    retry: async () => {
      const { lastRequest, submit } = get()
      return lastRequest ? submit(lastRequest) : false
    },
    reset: () => {
      get().controller?.abort()
      set(initialPlanActivitiesCheckState)
    },
  }),
)
