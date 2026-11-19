import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { SavedPlan } from "../types/savedPlan"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

const id = "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"

const plan: SavedPlan = {
  id,
  name: "Weekend in Kaunas",
  savedAt: "2026-11-18T12:05:00Z",
  location: {
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-21", "2026-11-22"],
  maxTravelDistanceKm: 30,
  scheduled: [
    {
      activityName: "Cycling",
      date: "2026-11-21",
      startTime: "10:00",
      endTime: "13:00",
      place: {
        name: "Nemunas cycle path",
        latitude: 54.8972,
        longitude: 23.8861,
        distanceKm: 3.4,
        area: "Kaunas",
      },
      weather: {
        temperatureC: 8.5,
        rainMmPerHour: 0,
        windMs: 3.2,
        isIndoor: false,
      },
      travel: null,
    },
    {
      activityName: "Museum",
      date: "2026-11-21",
      startTime: "14:00",
      endTime: "16:00",
      place: {
        name: "Kaunas Castle",
        latitude: 54.8985,
        longitude: 23.8853,
        distanceKm: 1.2,
        area: "Kaunas",
      },
      weather: {
        temperatureC: null,
        rainMmPerHour: null,
        windMs: null,
        isIndoor: true,
      },
      travel: {
        fromPlaceName: "Nemunas cycle path",
        distanceKm: 1.1,
        overLimit: false,
      },
    },
  ],
  unscheduled: [{ activityName: "Kayaking", reason: "noSuitableTime" }],
  travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
}

function render(
  answer: (request: RecordedRequest) => Response | Promise<Response>,
) {
  const routes = routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    [`GET /api/plans/${id}`]: answer,
  })
  renderAppWithLocation(`/plans/${id}`)
  return routes
}

describe("PlanDetailsPage", () => {
  it("shows the plan's name, breadcrumbs, setup, saved time and note", async () => {
    render(() => jsonResponse(200, plan))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Weekend in Kaunas",
      }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Weekend in Kaunas - Spėk laiku")
    const breadcrumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(
      within(breadcrumbs).getByRole("link", { name: "Home" }),
    ).toHaveAttribute("href", "/")
    expect(
      within(breadcrumbs).getByRole("link", { name: "My plans" }),
    ).toHaveAttribute("href", "/plans")
    expect(within(breadcrumbs).getByText("Weekend in Kaunas")).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(screen.getByText("Kaunas, Kaunas County")).toBeInTheDocument()
    expect(screen.getByText("Sat 21 Nov, Sun 22 Nov")).toBeInTheDocument()
    expect(screen.getByText("30 km")).toBeInTheDocument()
    expect(
      screen.getByText("Saved on Wed 18 Nov 2026 at 14:05"),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        "This is your plan as saved on Wed 18 Nov 2026. The forecast may have changed since.",
      ),
    ).toBeInTheDocument()
  })

  it("shows the schedule as saved, in the Schedule Overview's layout", async () => {
    render(() => jsonResponse(200, plan))

    const schedule = await screen.findByRole("region", {
      name: "Scheduled activities",
    })
    expect(schedule).toHaveTextContent("Cycling")
    expect(schedule).toHaveTextContent("Travel: 1.1 km from Nemunas cycle path")
    expect(
      within(
        screen.getByRole("region", { name: "Could not be scheduled" }),
      ).getByText(/Kayaking/),
    ).toBeInTheDocument()
    expect(
      screen.getByText("✓ All trips within your 30 km limit."),
    ).toBeInTheDocument()
  })

  // Feature 011 adds the plan's actions; saving and recalculating are still not offered (feature 012).
  it("offers no save or recalculate action and generates nothing", async () => {
    const { requests } = render(() => jsonResponse(200, plan))

    await screen.findByRole("heading", { level: 1, name: "Weekend in Kaunas" })

    expect(screen.queryByRole("button", { name: /save plan/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /recalculate/i })).toBeNull()
    expect(requests.map((request) => request.path)).not.toContain(
      "/api/plan-schedule",
    )
  })

  it("announces the loading state", async () => {
    render(() => new Promise<Response>(() => {}))

    const loading = await screen.findByText("Loading your plan…")
    expect(loading).toHaveAttribute("role", "status")
  })

  it("shows that a missing plan no longer exists, with links to Home and My plans", async () => {
    render(() =>
      jsonResponse(404, { status: 404, detail: "This plan no longer exists." }),
    )

    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan not found" }),
    ).toBeInTheDocument()
    expect(screen.getByText("This plan no longer exists.")).toBeInTheDocument()
    const main = within(screen.getByRole("main"))
    expect(
      main.getByRole("link", { name: "Go to the home page" }),
    ).toHaveAttribute("href", "/")
    expect(main.getByRole("link", { name: "Go to My plans" })).toHaveAttribute(
      "href",
      "/plans",
    )
  })

  it("shows Access denied for another user's plan, with no plan data", async () => {
    render(() => jsonResponse(403, { status: 403 }))

    expect(
      await screen.findByText("You do not have permission to open this page."),
    ).toBeInTheDocument()
    expect(screen.queryByText("Weekend in Kaunas")).toBeNull()
    const main = within(screen.getByRole("main"))
    expect(
      main.getByRole("link", { name: "Go to the home page" }),
    ).toHaveAttribute("href", "/")
    expect(main.getByRole("link", { name: "Go to My plans" })).toHaveAttribute(
      "href",
      "/plans",
    )
  })

  it("shows the server error with Retry, which loads again", async () => {
    let calls = 0
    const user = userEvent.setup()
    render(() => (++calls === 1 ? jsonResponse(500) : jsonResponse(200, plan)))

    expect(
      await screen.findByText(/Error: Plan could not be loaded\./),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Weekend in Kaunas",
      }),
    ).toBeInTheDocument()
  })

  it("opens from the Open link on My plans", async () => {
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () =>
        jsonResponse(200, [
          {
            id,
            name: plan.name,
            locationName: "Kaunas",
            dates: plan.dates,
            savedAt: plan.savedAt,
          },
        ]),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
    })
    const { currentLocation } = renderAppWithLocation("/plans")

    await user.click(
      await screen.findByRole("link", { name: "Open Weekend in Kaunas" }),
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Weekend in Kaunas",
      }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe(`/plans/${id}`)
  })
})

// Feature 011 User Story 1: deleting a plan from its page.
describe("PlanDetailsPage delete", () => {
  function renderWithDelete(
    answer: (request: RecordedRequest) => Response | Promise<Response>,
  ) {
    const routes = routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      [`DELETE /api/plans/${id}`]: answer,
      "GET /api/plans": () => jsonResponse(200, []),
    })
    return { ...routes, ...renderAppWithLocation(`/plans/${id}`) }
  }

  it("opens My plans with 'Plan deleted.' after confirming", async () => {
    const user = userEvent.setup()
    const { currentLocation } = renderWithDelete(() => jsonResponse(204))
    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    await user.click(
      within(
        screen.getByRole("dialog", {
          name: "Delete 'Weekend in Kaunas'? This cannot be undone.",
        }),
      ).getByRole("button", { name: "Delete" }),
    )

    expect(
      await screen.findByRole("heading", { level: 1, name: "My plans" }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe("/plans")
    expect(await screen.findByText("Plan deleted.")).toHaveAttribute(
      "role",
      "status",
    )
  })

  it("stays on the page and says a plan deleted elsewhere no longer exists", async () => {
    const user = userEvent.setup()
    const { currentLocation } = renderWithDelete(() =>
      jsonResponse(404, { detail: "This plan no longer exists." }),
    )
    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    expect(
      await screen.findByText("This plan no longer exists."),
    ).toHaveAttribute("role", "alert")
    expect(currentLocation()).toBe(`/plans/${id}`)
  })
})
