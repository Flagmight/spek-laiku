import { describe, expect, it } from "vitest"
import {
  initialPlanSetupState,
  planSetupStorageKey,
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

  it("shows the distance the server kept and stays checked", () => {
    store().setMaxTravelDistanceText("")

    store().setChecked(checkedSetup)

    expect(store().maxTravelDistanceText).toBe("30")
    expect(store().checked).toEqual(checkedSetup)
  })

  it("clear() returns to the initial state", () => {
    checkedState()
    store().setMaxTravelDistanceText("50")

    store().clear()

    expect(store()).toMatchObject(initialPlanSetupState)
  })
})

function stored() {
  const text = sessionStorage.getItem(planSetupStorageKey)
  return text === null
    ? null
    : (JSON.parse(text) as { state: unknown; version: number })
}

describe("usePlanSetupStore in the browser tab's session", () => {
  it("saves the location, dates, distance, checked setup and notice with version 1", () => {
    checkedState()
    store().setMaxTravelDistanceText("45")

    expect(stored()).toEqual({
      state: {
        locationText: "Kaunas, Kaunas County",
        location: kaunas,
        dates: ["2026-11-07"],
        maxTravelDistanceText: "45",
        checked: null,
        recheckNotice: false,
      },
      version: 1,
    })
  })

  it("restores the saved setup, as after a reload", async () => {
    checkedState()
    const saved = sessionStorage.getItem(planSetupStorageKey)!
    usePlanSetupStore.setState(initialPlanSetupState)
    sessionStorage.setItem(planSetupStorageKey, saved)

    await usePlanSetupStore.persist.rehydrate()

    expect(store().location).toEqual(kaunas)
    expect(store().dates).toEqual(["2026-11-07"])
    expect(store().checked).toEqual(checkedSetup)
  })

  it("starts empty when the saved text cannot be read", async () => {
    sessionStorage.setItem(planSetupStorageKey, "not json")

    await usePlanSetupStore.persist.rehydrate()

    expect(store()).toMatchObject(initialPlanSetupState)
  })

  it("starts empty when the saved setup has another version", async () => {
    sessionStorage.setItem(
      planSetupStorageKey,
      JSON.stringify({
        state: { ...initialPlanSetupState, dates: ["2026-11-07"] },
        version: 0,
      }),
    )

    await usePlanSetupStore.persist.rehydrate()

    expect(store()).toMatchObject(initialPlanSetupState)
  })

  it("clear() also empties the saved setup", () => {
    checkedState()

    store().clear()

    expect(stored()?.state).toEqual(initialPlanSetupState)
  })
})

describe("usePlanSetupStore 'checked again' notice", () => {
  it("markOutdated() unchecks the setup and turns the notice on", () => {
    checkedState()

    store().markOutdated()

    expect(store().checked).toBeNull()
    expect(store().recheckNotice).toBe(true)
    expect(store().dates).toEqual(["2026-11-07"])
  })

  it("keeps the notice through changes until the next successful check", () => {
    checkedState()
    store().markOutdated()

    store().removeDate("2026-11-07")
    store().addDate("2026-11-08")
    store().setMaxTravelDistanceText("40")
    expect(store().recheckNotice).toBe(true)

    store().setChecked(checkedSetup)
    expect(store().recheckNotice).toBe(false)
  })

  it("clear() turns the notice off", () => {
    store().markOutdated()

    store().clear()

    expect(store().recheckNotice).toBe(false)
  })

  it("keeps the notice after a reload", async () => {
    checkedState()
    store().markOutdated()
    const saved = sessionStorage.getItem(planSetupStorageKey)!
    usePlanSetupStore.setState(initialPlanSetupState)
    sessionStorage.setItem(planSetupStorageKey, saved)

    await usePlanSetupStore.persist.rehydrate()

    expect(store().recheckNotice).toBe(true)
    expect(store().checked).toBeNull()
  })

  it("gives a setup saved before the notice existed no notice", async () => {
    sessionStorage.setItem(
      planSetupStorageKey,
      JSON.stringify({
        state: {
          locationText: "Kaunas, Kaunas County",
          location: kaunas,
          dates: ["2026-11-07"],
          maxTravelDistanceText: "30",
          checked: checkedSetup,
        },
        version: 1,
      }),
    )

    await usePlanSetupStore.persist.rehydrate()

    expect(store().checked).toEqual(checkedSetup)
    expect(store().recheckNotice).toBe(false)
  })
})
