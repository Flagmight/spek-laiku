import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { planKey } from "../helpers/planKey"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { CheckedPlanSetup } from "../types/planSetup"

// A generated schedule kept while its user goes to Log in or Register to save it (feature 010 spec FR-007,
// research section 8). The schedule store itself is never kept (feature 008 FR-014); this copy is only made on
// that route. It is kept in sessionStorage, like the setup, so it survives the login in the same tab and is
// gone when the tab closes; logging out clears it (useLogoutStore).
export const keptScheduleStorageKey = "spek-laiku-kept-schedule"

interface KeptSchedule {
  // The plan the schedule was generated from, so it is never shown for a plan changed since.
  key: string
  schedule: PlanSchedule
}

export interface KeptScheduleState {
  kept: KeptSchedule | null
  keep: (
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
    schedule: PlanSchedule,
  ) => void
  // Returns the kept schedule when it belongs to this plan, without removing it, so a page that runs its
  // start-up twice (React StrictMode) finds it both times. A schedule kept for a changed plan is removed.
  // The page clears it once it has been shown, so it is shown once.
  find: (
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
  ) => PlanSchedule | null
  clear: () => void
}

export const useKeptScheduleStore = create<KeptScheduleState>()(
  persist(
    (set, get) => ({
      kept: null,
      keep: (setup, activities, schedule) =>
        set({ kept: { key: planKey(setup, activities), schedule } }),
      find: (setup, activities) => {
        const kept = get().kept
        if (kept?.key === planKey(setup, activities)) {
          return kept.schedule
        }

        if (kept) {
          set({ kept: null })
        }
        return null
      },
      clear: () => set({ kept: null }),
    }),
    {
      name: keptScheduleStorageKey,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ kept: state.kept }),
      // A schedule stored in any other shape is dropped; the page generates a new one.
      migrate: () => ({ kept: null }),
    },
  ),
)
