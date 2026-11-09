import { cleanup, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import {
  initialPlanActivitiesState,
  planActivitiesStorageKey,
  usePlanActivitiesStore,
} from "../stores/usePlanActivitiesStore"
import {
  initialPlanSetupState,
  planSetupStorageKey,
  usePlanSetupStore,
} from "../stores/usePlanSetupStore"
import type { CurrentUser } from "../types/currentUser"
import type { PlanCategory } from "../types/planActivity"
import type { PlanLocation } from "../types/planSetup"
import { jsonResponse, renderApp, routeFetch, signedInUser } from "./renderApp"

const period = { firstDate: "2026-11-04", lastDate: "2026-11-10", maxDates: 7 }

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

// What a user entered on Plan setup earlier in this tab.
function enterSetup(dates: string[] = ["2026-11-07", "2026-11-08"]) {
  const store = usePlanSetupStore.getState()
  store.chooseLocation(kaunas)
  for (const date of dates) {
    store.addDate(date)
  }
  store.setMaxTravelDistanceText("45")
}

function navigation() {
  return within(screen.getByRole("navigation", { name: "Main" }))
}

function chips() {
  return within(screen.getByRole("group", { name: "Dates" }))
    .queryAllByRole("listitem")
    .map((chip) => chip.firstChild?.textContent)
}

async function expectKeptSetup() {
  expect(await screen.findByRole("combobox", { name: "Location" })).toHaveValue(
    "Kaunas, Kaunas County",
  )
  expect(chips()).toEqual(["Sat 7 Nov 2026", "Sun 8 Nov 2026"])
  expect(screen.getByLabelText("Maximum travel distance (km)")).toHaveValue(
    "45",
  )
}

async function expectEmptySetup() {
  expect(await screen.findByRole("combobox", { name: "Location" })).toHaveValue(
    "",
  )
  expect(chips()).toEqual([])
  expect(screen.getByLabelText("Maximum travel distance (km)")).toHaveValue(
    "30",
  )
}

// /api/auth/me answers with whoever is signed in at that moment.
function stubSession(
  initialUser: CurrentUser | null,
  extra: Record<string, () => Response> = {},
) {
  const session = { user: initialUser }
  routeFetch({
    "GET /api/auth/me": () =>
      session.user ? jsonResponse(200, session.user) : jsonResponse(401),
    "GET /api/plan-setup/period": () => jsonResponse(200, period),
    ...extra,
  })
  return session
}

describe("Plan setup kept in this tab's session", () => {
  it("keeps the setup when the user leaves Plan setup and comes back", async () => {
    enterSetup()
    stubSession(null)
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await expectKeptSetup()

    await user.click(navigation().getByRole("link", { name: "Home" }))
    await screen.findByRole("heading", { level: 1, name: "Spėk laiku" })
    await user.click(navigation().getByRole("link", { name: "Create plan" }))

    await expectKeptSetup()
  })

  it("restores the setup after a reload", async () => {
    enterSetup()
    const saved = sessionStorage.getItem(planSetupStorageKey)!
    // A reload loses everything in memory; only the tab's storage is left.
    usePlanSetupStore.setState(initialPlanSetupState)
    sessionStorage.setItem(planSetupStorageKey, saved)
    await usePlanSetupStore.persist.rehydrate()
    stubSession(null)

    renderApp("/plan/setup")

    await expectKeptSetup()
  })

  it("keeps a visitor's setup after logging in", async () => {
    enterSetup()
    const session = stubSession(null, {
      "POST /api/auth/login": () => {
        session.user = signedInUser()
        return jsonResponse(200, session.user)
      },
    })
    const user = userEvent.setup()
    renderApp("/login")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))
    await screen.findByRole("button", { name: "Log out" })

    await user.click(navigation().getByRole("link", { name: "Create plan" }))

    await expectKeptSetup()
  })

  it("keeps a visitor's setup after registering", async () => {
    enterSetup()
    const session = stubSession(null, {
      "POST /api/registration": () => {
        session.user = signedInUser()
        return jsonResponse(201, {})
      },
    })
    const user = userEvent.setup()
    renderApp("/register")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Create account" }))
    await screen.findByText("✓ Success: Account created.")
    await screen.findByRole("button", { name: "Log out" })

    await user.click(navigation().getByRole("link", { name: "Create plan" }))

    await expectKeptSetup()
  })

  it("clears the setup when the user logs out", async () => {
    enterSetup()
    const session = stubSession(signedInUser(), {
      "POST /api/auth/logout": () => {
        session.user = null
        return new Response(null, { status: 204 })
      },
    })
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await expectKeptSetup()

    await user.click(navigation().getByRole("button", { name: "Log out" }))
    await screen.findByText("✓ Success: You have logged out.")
    await user.click(navigation().getByRole("link", { name: "Create plan" }))

    await expectEmptySetup()
    expect(
      JSON.parse(sessionStorage.getItem(planSetupStorageKey)!).state,
    ).toEqual(initialPlanSetupState)
  })

  it("keeps the setup when logging out fails", async () => {
    enterSetup()
    stubSession(signedInUser(), {
      "POST /api/auth/logout": () => jsonResponse(500),
    })
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await expectKeptSetup()

    await user.click(navigation().getByRole("button", { name: "Log out" }))
    await screen.findByText("Error: Something went wrong. Try again.")

    expect(usePlanSetupStore.getState().location).toEqual(kaunas)
    cleanup()
    stubSession(signedInUser())
    renderApp("/plan/setup")
    await expectKeptSetup()
  })

  it("marks a kept date that has passed instead of removing it", async () => {
    enterSetup(["2026-11-03", "2026-11-07"])
    stubSession(null)

    renderApp("/plan/setup")

    const firstChip = await waitFor(() => {
      const chip = within(
        screen.getByRole("group", { name: "Dates" }),
      ).getAllByRole("listitem")[0]
      expect(chip).toHaveTextContent("Error: Dates cannot be in the past.")
      return chip
    })
    expect(firstChip).toHaveTextContent("Tue 3 Nov 2026")
    expect(usePlanSetupStore.getState().dates).toEqual([
      "2026-11-03",
      "2026-11-07",
    ])
  })
})

const cycling: PlanCategory = {
  id: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  defaultDurationHours: 3,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 1,
  minTemperatureC: 5,
  maxTemperatureC: 30,
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

const categoriesRoute = {
  "GET /api/plan-activities/categories": () =>
    jsonResponse(200, { categories: [cycling, museum], maxActivities: 10 }),
}

// A setup the server accepted, and two activities with one changed setting.
function enterActivities() {
  enterSetup()
  usePlanSetupStore.getState().setChecked({
    location: kaunas,
    dates: ["2026-11-07", "2026-11-08"],
    maxTravelDistanceKm: 45,
  })
  const store = usePlanActivitiesStore.getState()
  store.add(cycling)
  store.add(museum)
  const [first] = usePlanActivitiesStore.getState().activities
  store.update(first.id, { durationText: "4.5" })
}

async function expectKeptActivitiesOnThePage() {
  const group = within(await screen.findByRole("group", { name: "Cycling" }))
  expect(group.getByLabelText("Duration (h)")).toHaveValue("4.5")
  expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
}

function expectKeptActivities() {
  const { activities } = usePlanActivitiesStore.getState()
  expect(activities.map((activity) => activity.name)).toEqual([
    "Cycling",
    "Museum",
  ])
  expect(activities[0].durationText).toBe("4.5")
  expect(
    JSON.parse(sessionStorage.getItem(planActivitiesStorageKey)!).state
      .activities,
  ).toEqual(activities)
}

function expectNoActivities() {
  expect(usePlanActivitiesStore.getState()).toMatchObject(
    initialPlanActivitiesState,
  )
  expect(
    JSON.parse(sessionStorage.getItem(planActivitiesStorageKey)!).state,
  ).toEqual(initialPlanActivitiesState)
}

describe("Plan activities kept in this tab's session", () => {
  it("restores the activities and a changed setting after a reload", async () => {
    enterActivities()
    const savedSetup = sessionStorage.getItem(planSetupStorageKey)!
    const savedActivities = sessionStorage.getItem(planActivitiesStorageKey)!
    // A reload loses everything in memory; only the tab's storage is left.
    usePlanSetupStore.setState(initialPlanSetupState)
    usePlanActivitiesStore.setState(initialPlanActivitiesState)
    sessionStorage.setItem(planSetupStorageKey, savedSetup)
    sessionStorage.setItem(planActivitiesStorageKey, savedActivities)
    await usePlanSetupStore.persist.rehydrate()
    await usePlanActivitiesStore.persist.rehydrate()
    stubSession(null, categoriesRoute)

    renderApp("/plan/activities")

    await expectKeptActivitiesOnThePage()
  })

  it("keeps a visitor's activities after logging in", async () => {
    enterActivities()
    const session = stubSession(null, {
      "POST /api/auth/login": () => {
        session.user = signedInUser()
        return jsonResponse(200, session.user)
      },
    })
    const user = userEvent.setup()
    renderApp("/login")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))
    await screen.findByRole("button", { name: "Log out" })

    expectKeptActivities()
  })

  it("keeps a visitor's activities after registering", async () => {
    enterActivities()
    const session = stubSession(null, {
      "POST /api/registration": () => {
        session.user = signedInUser()
        return jsonResponse(201, {})
      },
    })
    const user = userEvent.setup()
    renderApp("/register")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Create account" }))
    await screen.findByText("✓ Success: Account created.")
    await screen.findByRole("button", { name: "Log out" })

    expectKeptActivities()
  })

  it("clears the activities when the user logs out", async () => {
    enterActivities()
    const session = stubSession(signedInUser(), {
      ...categoriesRoute,
      "POST /api/auth/logout": () => {
        session.user = null
        return new Response(null, { status: 204 })
      },
    })
    const user = userEvent.setup()
    renderApp("/plan/activities")
    await expectKeptActivitiesOnThePage()

    await user.click(navigation().getByRole("button", { name: "Log out" }))
    await screen.findByText("✓ Success: You have logged out.")

    expectNoActivities()
  })

  it("keeps the activities when logging out fails", async () => {
    enterActivities()
    stubSession(signedInUser(), {
      ...categoriesRoute,
      "POST /api/auth/logout": () => jsonResponse(500),
    })
    const user = userEvent.setup()
    renderApp("/plan/activities")
    await expectKeptActivitiesOnThePage()

    await user.click(navigation().getByRole("button", { name: "Log out" }))
    await screen.findByText("Error: Something went wrong. Try again.")

    expectKeptActivities()
  })

  it("keeps the activities when a date changes on Plan setup", async () => {
    enterActivities()
    stubSession(null)
    const user = userEvent.setup()
    renderApp("/plan/setup")
    await expectKeptSetup()

    await user.click(
      screen.getByRole("button", { name: "Remove Sun 8 Nov 2026" }),
    )

    expect(chips()).toEqual(["Sat 7 Nov 2026"])
    expectKeptActivities()
  })
})
