import { create } from "zustand"
import { listCategories } from "../api/activityCategoriesApi"
import type { ActivityCategory } from "../types/activityCategory"

// After this long without an answer the list counts as not loaded.
export const categoriesTimeoutMs = 10_000

export interface ActivityCategoriesState {
  status: "loading" | "loaded" | "error"
  categories: ActivityCategory[]
  controller: AbortController | null
  // Loads the list again; an earlier pending load is aborted, so the latest one wins.
  load: () => Promise<void>
  // Aborts a pending load and starts again from the initial state, for example when the page closes.
  reset: () => void
}

export const initialActivityCategoriesState: Pick<
  ActivityCategoriesState,
  "status" | "categories" | "controller"
> = { status: "loading", categories: [], controller: null }

export const useActivityCategoriesStore = create<ActivityCategoriesState>()(
  (set, get) => ({
    ...initialActivityCategoriesState,
    load: async () => {
      get().controller?.abort()
      const abort = new AbortController()
      set({ status: "loading", controller: abort })
      const timeout = setTimeout(() => abort.abort(), categoriesTimeoutMs)
      let loaded: Pick<ActivityCategoriesState, "status" | "categories">
      try {
        loaded = {
          status: "loaded",
          categories: await listCategories(abort.signal),
        }
      } catch {
        // A 5xx, a network error or the timeout. Technical details are never shown.
        loaded = { status: "error", categories: [] }
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
      set(initialActivityCategoriesState)
    },
  }),
)
