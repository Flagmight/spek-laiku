import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { CheckedPlanSetup, PlanLocation } from "../types/planSetup"

// The current plan's first step: location, dates and distance as entered, and the last setup the
// server accepted (data-model.md, Plan setup store). Kept in the browser only; nothing is saved to
// an account in this feature.
export interface PlanSetupState {
  // What is typed in Location (at most 100 characters).
  locationText: string
  // Set only by choosing a suggestion; typing clears it (spec FR-006).
  location: PlanLocation | null
  // yyyy-MM-dd, ascending, no duplicates.
  dates: string[]
  maxTravelDistanceText: string
  // The last successful check. Any change below sets it back to null (spec FR-019).
  checked: CheckedPlanSetup | null
  setLocationText: (text: string) => void
  chooseLocation: (location: PlanLocation) => void
  addDate: (date: string) => void
  removeDate: (date: string) => void
  setMaxTravelDistanceText: (text: string) => void
  setChecked: (setup: CheckedPlanSetup) => void
  clear: () => void
}

export const initialPlanSetupState: Pick<
  PlanSetupState,
  "locationText" | "location" | "dates" | "maxTravelDistanceText" | "checked"
> = {
  locationText: "",
  location: null,
  dates: [],
  maxTravelDistanceText: "30",
  checked: null,
}

export function locationLabel(location: PlanLocation): string {
  return `${location.name}, ${location.area}`
}

// Where the setup is kept between pages and reloads (research section 7). sessionStorage lasts as long
// as the browser tab: it survives a reload and a login in the same tab, and is gone when the tab closes
// (spec FR-017). Logging out clears it explicitly (useLogoutStore).
export const planSetupStorageKey = "spek-laiku-plan-setup"

type PlanSetupData = typeof initialPlanSetupState

export const usePlanSetupStore = create<PlanSetupState>()(
  persist(
    (set) => ({
      ...initialPlanSetupState,
      setLocationText: (text) =>
        set({ locationText: text, location: null, checked: null }),
      chooseLocation: (location) =>
        set({ location, locationText: locationLabel(location), checked: null }),
      addDate: (date) =>
        set((state) => ({
          // yyyy-MM-dd strings sort in date order.
          dates: [...new Set([...state.dates, date])].sort(),
          checked: null,
        })),
      removeDate: (date) =>
        set((state) => ({
          dates: state.dates.filter((existing) => existing !== date),
          checked: null,
        })),
      setMaxTravelDistanceText: (text) =>
        set({ maxTravelDistanceText: text, checked: null }),
      // Also shows the distance the server kept, so an empty field shows 30 again (spec US3 scenario 4);
      // this does not count as a change, so the setup stays checked.
      setChecked: (setup) =>
        set({
          checked: setup,
          maxTravelDistanceText: String(setup.maxTravelDistanceKm),
        }),
      clear: () => set(initialPlanSetupState),
    }),
    {
      name: planSetupStorageKey,
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      // Only the data is stored, never the actions.
      partialize: (state): PlanSetupData => ({
        locationText: state.locationText,
        location: state.location,
        dates: state.dates,
        maxTravelDistanceText: state.maxTravelDistanceText,
        checked: state.checked,
      }),
      // A setup stored in any other shape is dropped; the user starts again.
      migrate: () => initialPlanSetupState,
    },
  ),
)
