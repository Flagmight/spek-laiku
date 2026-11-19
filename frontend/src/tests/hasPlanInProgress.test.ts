import { describe, expect, it } from "vitest"
import { hasPlanInProgress } from "../helpers/hasPlanInProgress"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import {
  planEditStorageKey,
  usePlanEditStore,
} from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"

const setup: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.9,
    longitude: 23.9,
  },
  dates: ["2026-11-21"],
  maxTravelDistanceKm: 30,
}

const activities: CheckedPlanActivity[] = [
  {
    id: "museum",
    categoryId: "category-museum",
    name: "Museum",
    type: "Indoor",
    durationHours: 2,
    requiresDaylight: false,
    maxWindMs: null,
    maxRainMmPerHour: null,
    minTemperatureC: null,
    maxTemperatureC: null,
  },
]

// A plan in the tab that was saved and has not changed since.
function savedPlanInProgress() {
  usePlanSetupStore.getState().chooseLocation(setup.location)
  usePlanSetupStore.getState().addDate("2026-11-21")
  usePlanSetupStore.getState().setChecked(setup)
  usePlanActivitiesStore.getState().setChecked(activities)
  usePlanActivitiesStore.setState({
    activities: [
      {
        id: "museum",
        categoryId: "category-museum",
        name: "Museum",
        type: "Indoor",
        durationText: "2",
        requiresDaylight: false,
        maxWindText: "",
        maxRainText: "",
        minTemperatureText: "",
        maxTemperatureText: "",
      },
    ],
  })
  usePlanEditStore.getState().markSaved(setup, activities)
}

// Whether starting an edit must first ask to replace the plan in the tab (feature 011 spec FR-013).
describe("hasPlanInProgress", () => {
  it("is false for an empty tab", () => {
    expect(hasPlanInProgress()).toBe(false)
  })

  it("is true once a location is chosen", () => {
    usePlanSetupStore.getState().chooseLocation(setup.location)

    expect(hasPlanInProgress()).toBe(true)
  })

  it("is true once a date or an activity is added", () => {
    usePlanSetupStore.getState().addDate("2026-11-21")
    expect(hasPlanInProgress()).toBe(true)

    usePlanSetupStore.getState().clear()
    usePlanActivitiesStore.setState({
      activities: [
        {
          id: "a",
          categoryId: "c",
          name: "Museum",
          type: "Indoor",
          durationText: "2",
          requiresDaylight: false,
          maxWindText: "",
          maxRainText: "",
          minTemperatureText: "",
          maxTemperatureText: "",
        },
      ],
    })
    expect(hasPlanInProgress()).toBe(true)
  })

  it("is false for a plan that was saved and has not changed", () => {
    savedPlanInProgress()

    expect(hasPlanInProgress()).toBe(false)
  })

  it("is true for a saved plan once an activity changes", () => {
    savedPlanInProgress()

    usePlanActivitiesStore.getState().update("museum", { durationText: "3" })

    expect(hasPlanInProgress()).toBe(true)
  })

  it("is true while another plan is being edited", () => {
    savedPlanInProgress()
    usePlanEditStore
      .getState()
      .start({ planId: "plan-1", planName: "A", ownerEmail: "a@b.lt" })

    expect(hasPlanInProgress()).toBe(true)
  })
})

describe("usePlanEditStore", () => {
  const edit = {
    planId: "plan-1",
    planName: "Weekend in Kaunas",
    ownerEmail: "user@example.com",
  }

  it("keeps the edit in sessionStorage", () => {
    usePlanEditStore.getState().start(edit)

    expect(
      JSON.parse(sessionStorage.getItem(planEditStorageKey) ?? "{}").state,
    ).toEqual({ edit, savedPlanKey: null })
  })

  it("ends the edit and keeps the saved marker on clear", () => {
    usePlanEditStore.getState().markSaved(setup, activities)
    usePlanEditStore.getState().start(edit)

    usePlanEditStore.getState().clear()

    expect(usePlanEditStore.getState().edit).toBeNull()
    expect(usePlanEditStore.getState().savedPlanKey).not.toBeNull()
  })

  it("forgets the edit and the saved marker on clearAll", () => {
    usePlanEditStore.getState().markSaved(setup, activities)
    usePlanEditStore.getState().start(edit)

    usePlanEditStore.getState().clearAll()

    expect(usePlanEditStore.getState().edit).toBeNull()
    expect(usePlanEditStore.getState().savedPlanKey).toBeNull()
  })
})
