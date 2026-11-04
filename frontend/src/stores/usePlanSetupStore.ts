import { create } from "zustand"
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

export const usePlanSetupStore = create<PlanSetupState>()((set) => ({
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
  setChecked: (setup) => set({ checked: setup }),
  clear: () => set(initialPlanSetupState),
}))
