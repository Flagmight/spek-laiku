import { create } from "zustand"
import { getPlanPeriod } from "../api/planSetupApi"
import type { PlanPeriod } from "../types/planSetup"

// After this long without an answer the date limits count as not loaded (spec FR-010).
export const planPeriodTimeoutMs = 10_000

export interface PlanPeriodState {
  status: "loading" | "loaded" | "error"
  // The server's values, unchanged. Not persisted: Plan setup loads them each time it opens.
  period: PlanPeriod | null
  controller: AbortController | null
  // Loads the date limits again; an earlier pending load is aborted, so the latest one wins.
  load: () => Promise<void>
  // Aborts a pending load and starts again from the initial state, for example when the page closes.
  reset: () => void
}

export const initialPlanPeriodState: Pick<
  PlanPeriodState,
  "status" | "period" | "controller"
> = { status: "loading", period: null, controller: null }

export const usePlanPeriodStore = create<PlanPeriodState>()((set, get) => ({
  ...initialPlanPeriodState,
  load: async () => {
    get().controller?.abort()
    const abort = new AbortController()
    set({ status: "loading", controller: abort })
    const timeout = setTimeout(() => abort.abort(), planPeriodTimeoutMs)
    let loaded: Pick<PlanPeriodState, "status" | "period">
    try {
      loaded = { status: "loaded", period: await getPlanPeriod(abort.signal) }
    } catch {
      // A 5xx, a network error or the timeout. Technical details are never shown.
      loaded = { status: "error", period: null }
    } finally {
      clearTimeout(timeout)
    }

    // A later load or reset() has taken over, so this result is dropped.
    if (get().controller === abort) {
      set({ ...loaded, controller: null })
    }
  },
  reset: () => {
    get().controller?.abort()
    set(initialPlanPeriodState)
  },
}))
