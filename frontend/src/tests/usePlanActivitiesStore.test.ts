import { describe, expect, it } from "vitest"
import {
  initialPlanActivitiesState,
  usePlanActivitiesStore,
} from "../stores/usePlanActivitiesStore"
import type { CheckedPlanActivity, PlanCategory } from "../types/planActivity"

const kayaking: PlanCategory = {
  id: "category-kayaking",
  name: "Kayaking",
  type: "Outdoor",
  defaultDurationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: -5,
  maxTemperatureC: 35,
}

const museum: PlanCategory = {
  id: "category-museum",
  name: "Museum",
  type: "Indoor",
  defaultDurationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

const checkedKayaking: CheckedPlanActivity = {
  id: "activity-1",
  categoryId: kayaking.id,
  name: "Kayaking",
  type: "Outdoor",
  durationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: -5,
  maxTemperatureC: 35,
}

function store() {
  return usePlanActivitiesStore.getState()
}

// Adds two activities and marks them checked, so each test can see that its change clears the check.
function checkedActivities() {
  store().add(kayaking)
  store().add(museum)
  store().setChecked([checkedKayaking])
  const [first, second] = store().activities
  return { first, second }
}

describe("usePlanActivitiesStore", () => {
  it("starts with no activities and nothing checked", () => {
    expect(store()).toMatchObject({ activities: [], checked: null })
  })

  it("copies an Outdoor category's defaults as text", () => {
    store().add(kayaking)

    expect(store().activities).toEqual([
      {
        id: expect.any(String),
        categoryId: "category-kayaking",
        name: "Kayaking",
        type: "Outdoor",
        durationText: "2.5",
        requiresDaylight: true,
        maxWindText: "8",
        maxRainText: "0.5",
        minTemperatureText: "-5",
        maxTemperatureText: "35",
      },
    ])
  })

  it("gives an Indoor category empty limits", () => {
    store().add(museum)

    expect(store().activities[0]).toMatchObject({
      type: "Indoor",
      durationText: "2",
      requiresDaylight: false,
      maxWindText: "",
      maxRainText: "",
      minTemperatureText: "",
      maxTemperatureText: "",
    })
  })

  it("gives two adds of the same category different ids, in order of adding", () => {
    store().add(kayaking)
    store().add(museum)
    store().add(kayaking)

    const { activities } = store()
    expect(activities.map((activity) => activity.categoryId)).toEqual([
      "category-kayaking",
      "category-museum",
      "category-kayaking",
    ])
    expect(new Set(activities.map((activity) => activity.id)).size).toBe(3)
  })

  it("removes only the named activity and clears the check", () => {
    const { first, second } = checkedActivities()

    store().remove(first.id)

    expect(store().activities).toEqual([second])
    expect(store().checked).toBeNull()
  })

  it("updates only the named activity and clears the check", () => {
    const { first, second } = checkedActivities()

    store().update(first.id, { durationText: "3", requiresDaylight: false })

    expect(store().activities).toEqual([
      { ...first, durationText: "3", requiresDaylight: false },
      second,
    ])
    expect(store().checked).toBeNull()
  })

  it("clears the check when an activity is added", () => {
    checkedActivities()

    store().add(kayaking)

    expect(store().checked).toBeNull()
  })

  it("setChecked keeps the activities", () => {
    store().add(kayaking)
    const before = store().activities

    store().setChecked([checkedKayaking])

    expect(store().activities).toBe(before)
    expect(store().checked).toEqual([checkedKayaking])
  })

  it("clear() empties everything", () => {
    checkedActivities()

    store().clear()

    expect(store()).toMatchObject(initialPlanActivitiesState)
  })
})
