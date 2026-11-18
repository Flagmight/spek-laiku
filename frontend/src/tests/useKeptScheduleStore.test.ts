import { describe, expect, it } from "vitest"
import {
  keptScheduleStorageKey,
  useKeptScheduleStore,
} from "../stores/useKeptScheduleStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanSchedule } from "../types/planSchedule"
import type { CheckedPlanSetup } from "../types/planSetup"

const setup: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-14"],
  maxTravelDistanceKm: 30,
}

const activities: CheckedPlanActivity[] = [
  {
    id: "act-1",
    categoryId: "cat-museum",
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

const schedule: PlanSchedule = {
  generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
  scheduled: [],
  unscheduled: [{ activityName: "Museum", reason: "noPlace" }],
  travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
}

function store() {
  return useKeptScheduleStore.getState()
}

describe("useKeptScheduleStore", () => {
  it("returns the kept schedule for the same plan once", () => {
    store().keep(setup, activities, schedule)

    expect(store().take(setup, activities)).toEqual(schedule)
    expect(store().take(setup, activities)).toBeNull()
  })

  it("drops the kept schedule when the plan changed since", () => {
    store().keep(setup, activities, schedule)

    const changed = { ...setup, dates: ["2026-11-15"] }

    expect(store().take(changed, activities)).toBeNull()
    expect(store().kept).toBeNull()
  })

  it("drops the kept schedule when an activity changed", () => {
    store().keep(setup, activities, schedule)

    const changed = [{ ...activities[0], durationHours: 3 }]

    expect(store().take(setup, changed)).toBeNull()
  })

  it("is kept in sessionStorage, so it survives a reload in the same tab", async () => {
    store().keep(setup, activities, schedule)
    const stored = sessionStorage.getItem(keptScheduleStorageKey)
    expect(stored).toContain(schedule.generatedScheduleId)

    // A reload starts with an empty store and reads the tab's storage again.
    useKeptScheduleStore.setState({ kept: null })
    sessionStorage.setItem(keptScheduleStorageKey, stored!)
    await useKeptScheduleStore.persist.rehydrate()

    expect(store().take(setup, activities)).toEqual(schedule)
  })

  it("clears the kept schedule", () => {
    store().keep(setup, activities, schedule)

    store().clear()

    expect(store().kept).toBeNull()
  })
})
