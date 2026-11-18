import {
  render as renderWithLibrary,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it } from "vitest"
import { AppRoutes } from "../components/appRoutes"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanScheduleStore } from "../stores/usePlanScheduleStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { PlanLocation } from "../types/planSetup"
import type { PlanSchedule } from "../types/planSchedule"
import { jsonResponse, renderAppWithLocation, routeFetch } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

const checkedSetup = {
  location: kaunas,
  dates: ["2026-11-14", "2026-11-15"],
  maxTravelDistanceKm: 30,
}

const checkedActivities: CheckedPlanActivity[] = [
  {
    id: "act-1",
    categoryId: "cat-kayaking",
    name: "Kayaking",
    type: "Outdoor",
    durationHours: 2,
    requiresDaylight: true,
    maxWindMs: 8,
    maxRainMmPerHour: 0.5,
    minTemperatureC: 15,
    maxTemperatureC: 35,
  },
  {
    id: "act-2",
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

const scheduledKayaking = {
  activityName: "Kayaking",
  date: "2026-11-15",
  startTime: "10:00",
  endTime: "12:00",
  place: {
    name: "Slipway",
    latitude: 54.89,
    longitude: 23.93,
    distanceKm: 3.4,
    area: "Kaunas",
  },
  weather: {
    temperatureC: 18.5,
    rainMmPerHour: 0.2,
    windMs: 3.1,
    isIndoor: false,
  },
  travel: null,
}

const scheduledMuseum = {
  activityName: "Museum",
  date: "2026-11-14",
  startTime: "09:00",
  endTime: "11:00",
  place: {
    name: "City Museum",
    latitude: 54.9,
    longitude: 23.9,
    distanceKm: 1.1,
    area: "Kaunas",
  },
  weather: {
    temperatureC: null,
    rainMmPerHour: null,
    windMs: null,
    isIndoor: true,
  },
  travel: null,
}

function acceptPlan() {
  usePlanSetupStore.getState().setChecked(checkedSetup)
  usePlanActivitiesStore.getState().setChecked(checkedActivities)
}

function render(scheduleResponse: () => Response) {
  const user = userEvent.setup()
  const routes = routeFetch({
    "GET /api/auth/me": () => jsonResponse(401),
    "POST /api/plan-schedule": scheduleResponse,
  })
  renderAppWithLocation("/plan/schedule")
  return { user, ...routes }
}

function schedule(override: Partial<PlanSchedule> = {}): PlanSchedule {
  return {
    generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
    scheduled: [scheduledKayaking],
    unscheduled: [],
    travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
    ...override,
  }
}

describe("ScheduleOverviewPage", () => {
  beforeEach(() => {
    document.title = ""
  })

  it("has the heading, tab title and step 4 as the current step", async () => {
    acceptPlan()
    render(() => jsonResponse(200, schedule()))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Schedule overview",
      }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe("Schedule overview - Spėk laiku"),
    )
    const progress = within(
      screen.getByRole("navigation", { name: "Plan progress" }),
    )
    expect(progress.getByText("Schedule")).toHaveAttribute(
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
    expect(
      progress.getByRole("link", { name: "Places and forecast" }),
    ).toHaveAttribute("href", "/plan/places")
  })

  it("shows the loading message while generating", async () => {
    acceptPlan()
    // Stub a never-resolving request so the page stays loading.
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => new Promise(() => {}),
    })
    renderAppWithLocation("/plan/schedule")

    expect(
      await screen.findByText("Generating your schedule…"),
    ).toBeInTheDocument()
    // Check Back button is present even during loading.
    expect(screen.getByRole("link", { name: "Back" })).toBeInTheDocument()
    void user
  })

  it("calls generate on mount and reset on unmount", async () => {
    acceptPlan()
    render(() => jsonResponse(200, schedule()))

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    expect(usePlanScheduleStore.getState().status).toBe("loaded")
  })

  it("shows all activities scheduled banner when none are unscheduled", async () => {
    acceptPlan()
    render(() => jsonResponse(200, schedule({ unscheduled: [] })))

    expect(
      await screen.findByText("✓ All activities scheduled."),
    ).toBeInTheDocument()
  })

  it("displays scheduled activities grouped by date in ascending order", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, {
        generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
        scheduled: [scheduledKayaking, scheduledMuseum],
        unscheduled: [],
        travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
      }),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    // Museum is on 2026-11-14 (earlier date), Kayaking on 2026-11-15.
    const sections = screen.getAllByRole("region")
    const dateSections = sections.filter(
      (s) =>
        s.getAttribute("aria-label") === "2026-11-14" ||
        s.getAttribute("aria-label") === "2026-11-15",
    )
    expect(dateSections[0]).toHaveAttribute("aria-label", "2026-11-14")
    expect(dateSections[1]).toHaveAttribute("aria-label", "2026-11-15")
  })

  it("shows start/end time, activity name, place and weather for a scheduled outdoor activity", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, schedule({ scheduled: [scheduledKayaking] })),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    const item = screen.getByText(/Kayaking/).closest("li")!
    expect(item).toHaveTextContent("10:00–12:00")
    expect(item).toHaveTextContent("Kayaking")
    expect(item).toHaveTextContent("Slipway")
    expect(item).toHaveTextContent("3.4 km")
    expect(item).toHaveTextContent("3.1 m/s wind")
    expect(item).toHaveTextContent("0.2 mm/h rain")
    expect(item).toHaveTextContent("18.5 °C")
  })

  it("shows the place distance with one decimal place, like the trip distance", async () => {
    acceptPlan()
    const picnic = {
      ...scheduledKayaking,
      activityName: "Picnic",
      startTime: "13:00",
      place: { ...scheduledKayaking.place, name: "Parkas", distanceKm: 2 },
      travel: { fromPlaceName: "Slipway", distanceKm: 2, overLimit: false },
    }
    render(() =>
      jsonResponse(200, schedule({ scheduled: [scheduledKayaking, picnic] })),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    const entry = screen.getByText("Picnic").closest("li")!
    expect(entry).toHaveTextContent("Parkas (2.0 km)")
    expect(entry).toHaveTextContent("Travel: 2.0 km from Slipway")
  })

  it("shows the travel of each activity: the start of the day, then the trip from the previous place", async () => {
    acceptPlan()
    const picnic = {
      ...scheduledKayaking,
      activityName: "Picnic",
      startTime: "13:00",
      endTime: "15:00",
      place: { ...scheduledKayaking.place, name: "Santakos parkas" },
      travel: { fromPlaceName: "Slipway", distanceKm: 4.2, overLimit: false },
    }
    render(() =>
      jsonResponse(200, schedule({ scheduled: [scheduledKayaking, picnic] })),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    const first = screen.getByText("Kayaking").closest("li")!
    const second = screen.getByText("Picnic").closest("li")!
    expect(first).toHaveTextContent("Travel: Start of the day")
    expect(second).toHaveTextContent("Travel: 4.2 km from Slipway")
    // The travel comes after the place and the weather in the entry.
    expect(second.textContent!.indexOf("Travel:")).toBeGreaterThan(
      second.textContent!.indexOf("18.5 °C"),
    )
  })

  describe("travel limit", () => {
    // The layout has its own status region for success banners outside <main>; the page has one inside.
    async function pageStatus() {
      return within(await screen.findByRole("main")).findByRole("status")
    }

    function stop(
      activityName: string,
      startTime: string,
      travel: { distanceKm: number; overLimit: boolean },
    ) {
      return {
        ...scheduledKayaking,
        activityName,
        startTime,
        endTime: startTime,
        travel: { fromPlaceName: "Slipway", ...travel },
      }
    }

    it("marks a trip over the limit and counts it in the summary", async () => {
      acceptPlan()
      render(() =>
        jsonResponse(
          200,
          schedule({
            scheduled: [
              scheduledKayaking,
              stop("Picnic", "13:00", { distanceKm: 42, overLimit: true }),
            ],
            travel: { maxDistanceKm: 30, tripsOverLimit: 1 },
          }),
        ),
      )

      const status = await pageStatus()
      expect(status).toHaveTextContent("✓ All activities scheduled.")
      expect(status).toHaveTextContent("✗ 1 trip longer than your 30 km limit.")
      expect(screen.getByText("Picnic").closest("li")).toHaveTextContent(
        "Travel: ✗ 42.0 km from Slipway, more than your 30 km limit",
      )
    })

    it("counts several trips over the limit in the plural", async () => {
      acceptPlan()
      render(() =>
        jsonResponse(
          200,
          schedule({
            scheduled: [
              scheduledKayaking,
              stop("Picnic", "13:00", { distanceKm: 42, overLimit: true }),
              stop("Cycling", "16:00", { distanceKm: 35, overLimit: true }),
            ],
            travel: { maxDistanceKm: 30, tripsOverLimit: 2 },
          }),
        ),
      )

      expect(await pageStatus()).toHaveTextContent(
        "✗ 2 trips longer than your 30 km limit.",
      )
    })

    it("says all trips are within the limit, in the same status area as the scheduling summary", async () => {
      acceptPlan()
      render(() =>
        jsonResponse(
          200,
          schedule({
            scheduled: [
              scheduledKayaking,
              stop("Picnic", "13:00", { distanceKm: 4.2, overLimit: false }),
            ],
          }),
        ),
      )

      const status = await pageStatus()
      expect(
        within(screen.getByRole("main")).getAllByRole("status"),
      ).toHaveLength(1)
      expect(status).toHaveTextContent("✓ All activities scheduled.")
      expect(status).toHaveTextContent("✓ All trips within your 30 km limit.")
      expect(screen.getByText("Picnic").closest("li")).not.toHaveTextContent(
        "✗",
      )
    })

    it("has no travel summary when every date has one activity", async () => {
      acceptPlan()
      render(() => jsonResponse(200, schedule()))

      expect(await pageStatus()).toHaveTextContent(
        "✓ All activities scheduled.",
      )
      expect(screen.queryByText(/trips? (within|longer)/)).toBeNull()
    })

    it("has no travel summary when no activity could be scheduled", async () => {
      acceptPlan()
      render(() =>
        jsonResponse(
          200,
          schedule({
            scheduled: [],
            unscheduled: [{ activityName: "Kayaking", reason: "noPlace" }],
          }),
        ),
      )

      expect(
        await screen.findByText(/No suitable time found for any activity/),
      ).toBeInTheDocument()
      expect(within(screen.getByRole("main")).queryByRole("status")).toBeNull()
      expect(screen.queryByText(/trips? (within|longer)/)).toBeNull()
    })
  })

  it("shows the indoor weather message for an indoor activity", async () => {
    acceptPlan()
    render(() => jsonResponse(200, schedule({ scheduled: [scheduledMuseum] })))

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    const item = screen.getByText("Museum").closest("li")!
    expect(item).toHaveTextContent(
      "Weather does not affect this indoor activity.",
    )
  })

  it("shows the unscheduled section heading when some activities could not be scheduled", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, {
        generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
        scheduled: [scheduledKayaking],
        unscheduled: [{ activityName: "Cycling", reason: "noSuitableTime" }],
        travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
      }),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    expect(
      screen.getByRole("heading", { name: "Could not be scheduled" }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Cycling/)).toHaveTextContent(
      "No suitable time found",
    )
  })

  it("shows reason text for noPlace", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, {
        generatedScheduleId: null,
        scheduled: [],
        unscheduled: [{ activityName: "Kayaking", reason: "noPlace" }],
        travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
      }),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    expect(screen.getByText(/Kayaking/)).toHaveTextContent("No place found")
  })

  it("shows the all-unscheduled notice when no activities could be scheduled", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, {
        generatedScheduleId: null,
        scheduled: [],
        unscheduled: [{ activityName: "Kayaking", reason: "noSuitableTime" }],
        travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
      }),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    expect(
      screen.getByText(/No suitable time found for any activity/),
    ).toBeInTheDocument()
    // The unscheduled section is still shown.
    expect(
      screen.getByRole("heading", { name: "Could not be scheduled" }),
    ).toBeInTheDocument()
  })

  it("does not show the all-unscheduled notice when some activities were scheduled", async () => {
    acceptPlan()
    render(() =>
      jsonResponse(200, {
        generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
        scheduled: [scheduledKayaking],
        unscheduled: [{ activityName: "Cycling", reason: "noSuitableTime" }],
        travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
      }),
    )

    await screen.findByRole("heading", { level: 1, name: "Schedule overview" })

    expect(
      screen.queryByText(/No suitable time found for any activity/),
    ).not.toBeInTheDocument()
  })
})

describe("ScheduleOverviewPage error states", () => {
  it("shows weatherUnavailable error with Retry", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(503, { status: 503, service: "forecast" }),
    })
    const user = userEvent.setup()
    renderAppWithLocation("/plan/schedule")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("The weather service is unavailable.")
    expect(
      within(alert).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument()
    void user
  })

  it("shows placesUnavailable error with Retry", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(503, { status: 503, service: "places" }),
    })
    renderAppWithLocation("/plan/schedule")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "The map data service is unavailable. No places are shown.",
    )
  })

  it("shows tooManyRequests error with Retry", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(429, { status: 429 }),
    })
    renderAppWithLocation("/plan/schedule")

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Too many requests. Wait a minute and try again.",
    )
  })

  it("shows serverError with Retry", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(500),
    })
    renderAppWithLocation("/plan/schedule")

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    )
  })

  it("calls retry when the Retry button is clicked", async () => {
    acceptPlan()
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(500),
    })
    renderAppWithLocation("/plan/schedule")

    await screen.findByRole("alert")
    expect(usePlanScheduleStore.getState().status).toBe("serverError")

    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(200, schedule()),
    })
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() =>
      expect(usePlanScheduleStore.getState().status).toBe("loaded"),
    )
  })
})

describe("ScheduleOverviewPage navigation", () => {
  it("goes Back to places and forecast when the Back link is clicked", async () => {
    acceptPlan()
    const user = userEvent.setup()
    const { currentLocation } = renderAppWithLocation("/plan/schedule")
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(200, schedule()),
      "POST /api/plan-forecast": () =>
        jsonResponse(200, { updatedAt: "14:05", days: [], activities: [] }),
      "POST /api/plan-places": () =>
        jsonResponse(200, { updatedAt: "14:05", radiusKm: 30, categories: [] }),
    })

    await screen.findByRole("link", { name: "Back" })
    await user.click(screen.getByRole("link", { name: "Back" }))

    await waitFor(() => expect(currentLocation()).toBe("/plan/places"))
  })

  it("redirects to plan setup when setup is not checked", async () => {
    // Don't call acceptPlan() — no setup.
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-14",
          lastDate: "2026-11-20",
          maxDates: 7,
        }),
    })
    const { currentLocation } = renderAppWithLocation("/plan/schedule")

    await waitFor(() => expect(currentLocation()).toBe("/plan/setup"))
  })

  it("redirects to activities when activities are not checked but setup is", async () => {
    usePlanSetupStore.getState().setChecked(checkedSetup)
    // No activities checked.
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-14",
          lastDate: "2026-11-20",
          maxDates: 7,
        }),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, { categories: [], maxActivities: 10 }),
    })
    const { currentLocation } = renderAppWithLocation("/plan/schedule")

    await waitFor(() => expect(currentLocation()).toBe("/plan/activities"))
  })

  it("redirects to plan setup when the server says setup is out of date", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(400, {
          errors: { "setup.dates[0]": ["Dates cannot be in the past."] },
        }),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-14",
          lastDate: "2026-11-20",
          maxDates: 7,
        }),
    })
    const { currentLocation } = renderAppWithLocation("/plan/schedule")

    await waitFor(() => expect(currentLocation()).toBe("/plan/setup"))
  })

  it("redirects to activities when the server says activities are out of date", async () => {
    acceptPlan()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () =>
        jsonResponse(400, {
          errors: { "activities[0]": ["Activity changed."] },
        }),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-14",
          lastDate: "2026-11-20",
          maxDates: 7,
        }),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, { categories: [], maxActivities: 10 }),
    })
    const { currentLocation } = renderAppWithLocation("/plan/schedule")

    await waitFor(() => expect(currentLocation()).toBe("/plan/activities"))
  })

  it("shows a schedule kept through Log in without generating a new one (feature 010 FR-007)", async () => {
    acceptPlan()
    const kept = schedule({ unscheduled: [] })
    useKeptScheduleStore.getState().keep(checkedSetup, checkedActivities, kept)
    const { requests } = render(() => jsonResponse(500))

    expect(
      await screen.findByText("✓ All activities scheduled."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Generating your schedule…")).toBeNull()
    expect(
      requests.filter((request) => request.path === "/api/plan-schedule"),
    ).toEqual([])
    expect(useKeptScheduleStore.getState().kept).toBeNull()
  })

  it("shows the kept schedule under StrictMode too, as main.tsx renders the app (code review finding 2)", async () => {
    acceptPlan()
    const kept = schedule({ unscheduled: [] })
    useKeptScheduleStore.getState().keep(checkedSetup, checkedActivities, kept)
    const { requests } = routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(500),
    })
    void useCurrentUserStore.getState().refresh()
    renderWithLibrary(
      <StrictMode>
        <MemoryRouter initialEntries={["/plan/schedule"]}>
          <AppRoutes />
        </MemoryRouter>
      </StrictMode>,
    )

    expect(
      await screen.findByText("✓ All activities scheduled."),
    ).toBeInTheDocument()
    expect(
      requests.filter((request) => request.path === "/api/plan-schedule"),
    ).toEqual([])
    expect(usePlanScheduleStore.getState().schedule).toEqual(kept)
    await waitFor(() => expect(useKeptScheduleStore.getState().kept).toBeNull())
  })

  it("generates a new schedule when the kept one belongs to a changed plan", async () => {
    acceptPlan()
    useKeptScheduleStore
      .getState()
      .keep(
        { ...checkedSetup, dates: ["2026-11-16"] },
        checkedActivities,
        schedule(),
      )
    const { requests } = render(() => jsonResponse(200, schedule()))

    await screen.findByText("✓ All activities scheduled.")
    expect(
      requests.filter((request) => request.path === "/api/plan-schedule"),
    ).toHaveLength(1)
    expect(useKeptScheduleStore.getState().kept).toBeNull()
  })

  it("resets the schedule store on unmount", async () => {
    acceptPlan()
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(401),
      "POST /api/plan-schedule": () => jsonResponse(200, schedule()),
      "POST /api/plan-forecast": () =>
        jsonResponse(200, { updatedAt: "14:05", days: [], activities: [] }),
      "POST /api/plan-places": () =>
        jsonResponse(200, { updatedAt: "14:05", radiusKm: 30, categories: [] }),
    })
    renderAppWithLocation("/plan/schedule")

    await screen.findByRole("link", { name: "Back" })
    expect(usePlanScheduleStore.getState().status).toBe("loaded")

    await user.click(screen.getByRole("link", { name: "Back" }))

    await waitFor(() =>
      expect(usePlanScheduleStore.getState().status).toBe("idle"),
    )
  })
})
