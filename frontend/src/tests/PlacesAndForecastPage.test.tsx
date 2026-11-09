import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity, PlanCategory } from "../types/planActivity"
import type { PlanLocation } from "../types/planSetup"
import { jsonResponse, renderAppWithLocation, routeFetch } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const cycling: PlanCategory = {
  id: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  defaultDurationHours: 2.5,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 0.5,
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

function acceptSetup() {
  usePlanSetupStore.getState().setChecked({
    location: kaunas,
    dates: ["2026-11-07"],
    maxTravelDistanceKm: 30,
  })
}

function checkedFrom(category: PlanCategory, id: string): CheckedPlanActivity {
  return {
    id,
    categoryId: category.id,
    name: category.name,
    type: category.type,
    durationHours: category.defaultDurationHours,
    requiresDaylight: category.requiresDaylight,
    maxWindMs: category.maxWindMs,
    maxRainMmPerHour: category.maxRainMmPerHour,
    minTemperatureC: category.minTemperatureC,
    maxTemperatureC: category.maxTemperatureC,
  }
}

// Activities the server accepted, as Continue on step 2 leaves them.
function acceptActivities(...categories: PlanCategory[]) {
  const store = usePlanActivitiesStore.getState()
  categories.forEach((category) => store.add(category))
  store.setChecked(
    usePlanActivitiesStore
      .getState()
      .activities.map((activity, index) =>
        checkedFrom(categories[index], activity.id),
      ),
  )
}

function render() {
  routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "GET /api/plan-setup/period": () =>
      jsonResponse(200, {
        firstDate: "2026-11-04",
        lastDate: "2026-11-10",
        maxDates: 7,
      }),
    "GET /api/plan-activities/categories": () =>
      jsonResponse(200, { categories: [cycling, museum], maxActivities: 10 }),
  })
  return renderAppWithLocation("/plan/places")
}

function heading(name: string) {
  return screen.findByRole("heading", { level: 1, name })
}

function activityItems() {
  return within(
    screen.getByRole("list", { name: "Plan activities" }),
  ).getAllByRole("listitem")
}

describe("Places and forecast page (first version)", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("has its heading, tab title and step 3 as the current step", async () => {
    acceptSetup()
    acceptActivities(cycling)
    render()

    await heading("Places and forecast")
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    await waitFor(() =>
      expect(document.title).toBe("Places and forecast - Spėk laiku"),
    )
    const progress = within(
      screen.getByRole("navigation", { name: "Plan progress" }),
    )
    expect(progress.getByText("Places and forecast")).toHaveAttribute(
      "aria-current",
      "step",
    )
    expect(progress.getByRole("link", { name: "Plan setup" })).toHaveAttribute(
      "href",
      "/plan/setup",
    )
    expect(progress.getByRole("link", { name: "Activities" })).toHaveAttribute(
      "href",
      "/plan/activities",
    )
  })

  it("shows the setup and each activity with its settings", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    render()
    await heading("Places and forecast")

    expect(
      screen.getByText(
        "Kaunas, Kaunas County · Sat 7 Nov 2026 · Maximum travel distance: 30 km",
      ),
    ).toBeInTheDocument()
    const [outdoor, indoor] = activityItems()
    expect(outdoor).toHaveTextContent("Cycling")
    expect(outdoor).toHaveTextContent("Outdoor")
    expect(outdoor).toHaveTextContent("2.5 h")
    expect(outdoor).toHaveTextContent("Requires daylight")
    expect(outdoor).toHaveTextContent(
      "Wind up to 10 m/s · Rain up to 0.5 mm/h · 5 to 30 °C",
    )
    expect(indoor).toHaveTextContent("Museum")
    expect(indoor).toHaveTextContent("Indoor")
    expect(indoor).toHaveTextContent("2 h")
    expect(indoor).toHaveTextContent("No daylight needed")
    expect(indoor).not.toHaveTextContent("Wind up to")
  })

  it("numbers a repeated category as on step 2", async () => {
    acceptSetup()
    acceptActivities(cycling, museum, cycling)
    render()
    await heading("Places and forecast")

    const [first, , second] = activityItems()
    expect(first).toHaveTextContent("Cycling 1")
    expect(second).toHaveTextContent("Cycling 2")
  })

  it("goes Back to Activity selection with every activity kept", async () => {
    acceptSetup()
    acceptActivities(cycling, museum)
    const user = userEvent.setup()
    const { currentLocation } = render()
    await heading("Places and forecast")

    await user.click(screen.getByRole("link", { name: "Back" }))

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
    expect(screen.getByRole("group", { name: "Cycling" })).toBeInTheDocument()
    expect(screen.getByRole("group", { name: "Museum" })).toBeInTheDocument()
  })

  it("sends a user without checked activities to Activity selection", async () => {
    acceptSetup()
    const { currentLocation } = render()

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
  })

  it("sends a user without a checked setup to Plan setup", async () => {
    acceptActivities(cycling)
    const { currentLocation } = render()

    await heading("Plan setup")
    expect(currentLocation()).toBe("/plan/setup")
  })

  it("needs a new check after an activity changes", async () => {
    acceptSetup()
    acceptActivities(cycling)
    const [activity] = usePlanActivitiesStore.getState().activities
    usePlanActivitiesStore.getState().update(activity.id, { durationText: "4" })
    const { currentLocation } = render()

    await heading("Activity selection")
    expect(currentLocation()).toBe("/plan/activities")
  })
})
