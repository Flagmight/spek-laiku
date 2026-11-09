import { create } from "zustand"
import { listPlanCategories } from "../api/planActivitiesApi"
import type { PlanCategory } from "../types/planActivity"

// After this long without an answer the categories count as not loaded (spec FR-004).
export const planCategoriesTimeoutMs = 10_000

export interface PlanCategoriesState {
  status: "loading" | "loaded" | "error"
  // Not persisted: Activity selection loads them each time it opens.
  categories: PlanCategory[]
  // The server's limit, the only copy the page uses; null until loaded (constitution I).
  maxActivities: number | null
  controller: AbortController | null
  // Loads the categories again; an earlier pending load is aborted, so the latest one wins.
  load: () => Promise<void>
  // Aborts a pending load and starts again from the initial state, for example when the page closes.
  reset: () => void
}

type PlanCategoriesData = Pick<
  PlanCategoriesState,
  "status" | "categories" | "maxActivities"
>

export const initialPlanCategoriesState: PlanCategoriesData &
  Pick<PlanCategoriesState, "controller"> = {
  status: "loading",
  categories: [],
  maxActivities: null,
  controller: null,
}

export const usePlanCategoriesStore = create<PlanCategoriesState>()(
  (set, get) => ({
    ...initialPlanCategoriesState,
    load: async () => {
      get().controller?.abort()
      const abort = new AbortController()
      set({ status: "loading", controller: abort })
      const timeout = setTimeout(() => abort.abort(), planCategoriesTimeoutMs)
      let loaded: PlanCategoriesData
      try {
        loaded = {
          status: "loaded",
          ...(await listPlanCategories(abort.signal)),
        }
      } catch {
        // A 5xx, a network error or the timeout. Technical details are never shown.
        loaded = { status: "error", categories: [], maxActivities: null }
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
      set(initialPlanCategoriesState)
    },
  }),
)
