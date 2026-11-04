import { describe, expect, it } from "vitest"
import {
  initialPlanSetupState,
  usePlanSetupStore,
} from "../stores/usePlanSetupStore"
import type { CheckedPlanSetup, PlanLocation } from "../types/planSetup"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const checkedSetup: CheckedPlanSetup = {
  location: kaunas,
  dates: ["2026-11-07"],
  maxTravelDistanceKm: 30,
}

function store() {
  return usePlanSetupStore.getState()
}

// Starts from a checked setup, so each test can see that its change clears it.
function checkedState() {
  store().chooseLocation(kaunas)
  store().addDate("2026-11-07")
  store().setChecked(checkedSetup)
  expect(store().checked).toEqual(checkedSetup)
}

describe("usePlanSetupStore", () => {
  it("starts empty, with the distance 30 and nothing checked", () => {
    expect(store()).toMatchObject({
      locationText: "",
      location: null,
      dates: [],
      maxTravelDistanceText: "30",
      checked: null,
    })
  })

  it("chooses a location and shows it as '<name>, <area>'", () => {
    store().chooseLocation(kaunas)

    expect(store().location).toEqual(kaunas)
    expect(store().locationText).toBe("Kaunas, Kaunas County")
  })

  it("clears the chosen location when the text changes", () => {
    store().chooseLocation(kaunas)

    store().setLocationText("Kaunas, Kaunas Count")

    expect(store().location).toBeNull()
    expect(store().locationText).toBe("Kaunas, Kaunas Count")
  })

  it("keeps dates in date order whatever order they are added in", () => {
    store().addDate("2026-11-08")
    store().addDate("2026-11-04")
    store().addDate("2026-11-10")

    expect(store().dates).toEqual(["2026-11-04", "2026-11-08", "2026-11-10"])
  })

  it("never holds the same date twice", () => {
    store().addDate("2026-11-07")
    store().addDate("2026-11-07")

    expect(store().dates).toEqual(["2026-11-07"])
  })

  it("removes a date", () => {
    store().addDate("2026-11-07")
    store().addDate("2026-11-08")

    store().removeDate("2026-11-07")

    expect(store().dates).toEqual(["2026-11-08"])
  })

  it("keeps the distance text as typed", () => {
    store().setMaxTravelDistanceText(" 45 ")

    expect(store().maxTravelDistanceText).toBe(" 45 ")
  })

  it.each([
    ["typing a location", () => store().setLocationText("Vilnius")],
    ["choosing a location", () => store().chooseLocation({ ...kaunas, id: 1 })],
    ["adding a date", () => store().addDate("2026-11-08")],
    ["removing a date", () => store().removeDate("2026-11-07")],
    ["changing the distance", () => store().setMaxTravelDistanceText("50")],
  ])("needs a new check after %s", (_change, change) => {
    checkedState()

    change()

    expect(store().checked).toBeNull()
  })

  it("clear() returns to the initial state", () => {
    checkedState()
    store().setMaxTravelDistanceText("50")

    store().clear()

    expect(store()).toMatchObject(initialPlanSetupState)
  })
})
