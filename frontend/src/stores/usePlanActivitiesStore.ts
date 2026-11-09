import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type {
  CheckedPlanActivity,
  PlanActivity,
  PlanCategory,
} from "../types/planActivity"

// The fields of an activity the user can change in this plan.
export type PlanActivityChanges = Partial<
  Pick<
    PlanActivity,
    | "durationText"
    | "requiresDaylight"
    | "maxWindText"
    | "maxRainText"
    | "minTemperatureText"
    | "maxTemperatureText"
  >
>

// The current plan's activities as entered, and the last list the server accepted
// (data-model.md, Plan activities store). It holds no activity limit: the category list disables
// Add at the server's maxActivities, and the server refuses more on Continue (constitution I).
export interface PlanActivitiesState {
  // In order of adding.
  activities: PlanActivity[]
  // The last successful check. Add, remove and update set it back to null (spec FR-018).
  checked: CheckedPlanActivity[] | null
  add: (category: PlanCategory) => void
  remove: (id: string) => void
  update: (id: string, changes: PlanActivityChanges) => void
  setChecked: (checked: CheckedPlanActivity[]) => void
  // Asks for a new check without touching the activities, after step 1 accepts a new setup.
  clearChecked: () => void
  clear: () => void
}

export const initialPlanActivitiesState: Pick<
  PlanActivitiesState,
  "activities" | "checked"
> = {
  activities: [],
  checked: null,
}

// The server sends null for an Indoor category's limits, which become empty fields.
function limitText(value: number | null): string {
  return value === null ? "" : String(value)
}

function activityFrom(category: PlanCategory): PlanActivity {
  return {
    id: crypto.randomUUID(),
    categoryId: category.id,
    name: category.name,
    type: category.type,
    durationText: String(category.defaultDurationHours),
    requiresDaylight: category.requiresDaylight,
    maxWindText: limitText(category.maxWindMs),
    maxRainText: limitText(category.maxRainMmPerHour),
    minTemperatureText: limitText(category.minTemperatureC),
    maxTemperatureText: limitText(category.maxTemperatureC),
  }
}

// Where the activities are kept between pages and reloads, next to the plan setup but in their own
// store, so changing the setup leaves them alone (research section 2). sessionStorage survives a
// reload and a login in the same tab and is gone when the tab closes; logging out clears it
// explicitly (useLogoutStore, spec FR-019).
export const planActivitiesStorageKey = "spek-laiku-plan-activities"

type PlanActivitiesData = typeof initialPlanActivitiesState

export const usePlanActivitiesStore = create<PlanActivitiesState>()(
  persist(
    (set) => ({
      ...initialPlanActivitiesState,
      add: (category) =>
        set((state) => ({
          activities: [...state.activities, activityFrom(category)],
          checked: null,
        })),
      remove: (id) =>
        set((state) => ({
          activities: state.activities.filter((activity) => activity.id !== id),
          checked: null,
        })),
      update: (id, changes) =>
        set((state) => ({
          activities: state.activities.map((activity) =>
            activity.id === id ? { ...activity, ...changes } : activity,
          ),
          checked: null,
        })),
      setChecked: (checked) => set({ checked }),
      clearChecked: () => set({ checked: null }),
      clear: () => set(initialPlanActivitiesState),
    }),
    {
      name: planActivitiesStorageKey,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // Only the data is stored, never the actions.
      partialize: (state): PlanActivitiesData => ({
        activities: state.activities,
        checked: state.checked,
      }),
      // Activities stored in any other shape are dropped; the user starts again.
      migrate: () => initialPlanActivitiesState,
    },
  ),
)
