import { describe, expect, it } from "vitest"
import { fillPlanFromSavedPlan } from "../helpers/planFromSavedPlan"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import { savedPlan } from "./savedPlansFixtures"

// "Edit plan" loads a saved plan into the planning steps (feature 011 spec FR-007, data-model.md).
describe("fillPlanFromSavedPlan", () => {
  it("fills the setup with the location, dates and distance, unchecked", () => {
    usePlanSetupStore.setState({ recheckNotice: true })

    fillPlanFromSavedPlan(savedPlan)

    const setup = usePlanSetupStore.getState()
    expect(setup.location).toEqual(savedPlan.location)
    expect(setup.locationText).toBe("Kaunas, Kaunas County")
    expect(setup.dates).toEqual(["2026-11-14"])
    expect(setup.maxTravelDistanceText).toBe("30")
    expect(setup.checked).toBeNull()
    expect(setup.recheckNotice).toBe(false)
  })

  it("fills the activities with their saved values as text, unchecked", () => {
    fillPlanFromSavedPlan(savedPlan)

    const { activities, checked, recheckNotice } =
      usePlanActivitiesStore.getState()
    expect(activities).toEqual([
      {
        id: expect.any(String),
        categoryId: "c1d2e3f4-0000-4000-8000-000000000001",
        name: "Cycling",
        type: "Outdoor",
        durationText: "2.5",
        requiresDaylight: true,
        maxWindText: "10",
        maxRainText: "1",
        minTemperatureText: "5",
        maxTemperatureText: "32",
      },
      {
        id: expect.any(String),
        categoryId: "c1d2e3f4-0000-4000-8000-000000000002",
        name: "Museum",
        type: "Indoor",
        durationText: "2",
        requiresDaylight: false,
        maxWindText: "",
        maxRainText: "",
        minTemperatureText: "",
        maxTemperatureText: "",
      },
    ])
    expect(activities[0].id).not.toBe(activities[1].id)
    expect(checked).toBeNull()
    expect(recheckNotice).toBe(false)
  })

  it("replaces whatever plan was in progress", () => {
    usePlanSetupStore.getState().addDate("2026-11-20")
    usePlanActivitiesStore.getState().add({
      id: "picnic",
      name: "Picnic",
      type: "Outdoor",
      defaultDurationHours: 2,
      requiresDaylight: true,
      maxWindMs: 8,
      maxRainMmPerHour: 0,
      minTemperatureC: 15,
      maxTemperatureC: 30,
    })

    fillPlanFromSavedPlan(savedPlan)

    expect(usePlanSetupStore.getState().dates).toEqual(["2026-11-14"])
    expect(
      usePlanActivitiesStore.getState().activities.map((a) => a.name),
    ).toEqual(["Cycling", "Museum"])
  })
})
