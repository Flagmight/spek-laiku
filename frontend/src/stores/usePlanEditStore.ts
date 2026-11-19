import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { planKey } from "../helpers/planKey"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"

// The saved plan the plan in progress was loaded from, and which plan it will replace (feature 011 research
// section 10). The email is the only user identifier the browser has, so another account cannot save over it.
export interface PlanEdit {
  planId: string
  planName: string
  ownerEmail: string
}

// The edit in progress and the saved marker (feature 011 spec FR-013, research section 10). The plan in
// progress itself stays in the setup and activities stores. Both are kept in sessionStorage, like those stores,
// so they survive a reload and a login in the same tab and are gone when the tab closes; logging out clears them.
export interface PlanEditState {
  edit: PlanEdit | null
  // The key of the setup and activities at the last successful Save plan or Save changes. A plan in progress
  // with this key is saved, so replacing it needs no confirmation.
  savedPlanKey: string | null
  start: (edit: PlanEdit) => void
  // Follows a rename of the plan being edited; an edit of another plan is left alone.
  rename: (planId: string, planName: string) => void
  // Ends the edit; the saved marker stays.
  clear: () => void
  markSaved: (
    setup: CheckedPlanSetup,
    activities: CheckedPlanActivity[],
  ) => void
  // Ends the edit and forgets the saved marker, for logout and another account.
  clearAll: () => void
}

export const planEditStorageKey = "spek-laiku-plan-edit"

type PlanEditData = Pick<PlanEditState, "edit" | "savedPlanKey">

export const initialPlanEditState: PlanEditData = {
  edit: null,
  savedPlanKey: null,
}

export const usePlanEditStore = create<PlanEditState>()(
  persist(
    (set) => ({
      ...initialPlanEditState,
      start: (edit) => set({ edit }),
      rename: (planId, planName) =>
        set((state) =>
          state.edit?.planId === planId
            ? { edit: { ...state.edit, planName } }
            : {},
        ),
      clear: () => set({ edit: null }),
      markSaved: (setup, activities) =>
        set({ savedPlanKey: planKey(setup, activities) }),
      clearAll: () => set(initialPlanEditState),
    }),
    {
      name: planEditStorageKey,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state): PlanEditData => ({
        edit: state.edit,
        savedPlanKey: state.savedPlanKey,
      }),
      // An edit stored in any other shape is dropped; the saved plan is unchanged.
      migrate: () => initialPlanEditState,
    },
  ),
)
