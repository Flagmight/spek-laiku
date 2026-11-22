import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanCheckStore } from "../stores/usePlanCheckStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { SavedPlan } from "../types/savedPlan"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"
import {
  acceptMuseumPlan,
  noProblemCheckRoute,
  planCheckWith,
  problem,
  savedPlan,
} from "./savedPlansFixtures"

const id = "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"

const plan: SavedPlan = {
  id,
  name: "Weekend in Kaunas",
  savedAt: "2026-11-18T12:05:00Z",
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-21", "2026-11-22"],
  maxTravelDistanceKm: 30,
  activities: savedPlan.activities,
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

// The plan page with the given plan answer. The plan check (feature 012) finds no problem unless another answer
// is given.
function render(
  answer: (request: RecordedRequest) => Response | Promise<Response>,
  checkAnswer?: (request: RecordedRequest) => Response | Promise<Response>,
) {
  const routes = routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    [`GET /api/plans/${id}`]: answer,
    ...noProblemCheckRoute(plan),
    ...(checkAnswer && { [`GET /api/plans/${id}/check`]: checkAnswer }),
  })
  renderAppWithLocation(`/plans/${id}`)
  return routes
}

describe("PlanDetailsPage", () => {
  it("shows the plan's name, breadcrumbs, setup, saved time and note", async () => {
    // Until the plan check has an answer, the note says this is the plan as saved (feature 012 spec FR-013).
    render(
      () => jsonResponse(200, plan),
      () => new Promise<Response>(() => {}),
    )

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

  // Feature 011 adds the plan's actions and feature 012 Recalculate (its tests are under "plan check"); saving
  // is still not offered, and nothing is generated.
  it("offers no save action and generates nothing", async () => {
    const { requests } = render(() => jsonResponse(200, plan))

    await screen.findByRole("heading", { level: 1, name: "Weekend in Kaunas" })

    expect(screen.queryByRole("button", { name: /save plan/i })).toBeNull()
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
      ...noProblemCheckRoute(plan),
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
      ...noProblemCheckRoute(plan),
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

// Feature 011 User Story 2: duplicating a plan from its page.
describe("PlanDetailsPage duplicate", () => {
  const copyId = "5d2e9a7c-1b3f-4c8d-a6e2-9f0b1c2d3e4f"
  const copy: SavedPlan = {
    ...plan,
    id: copyId,
    name: "Copy of Weekend in Kaunas",
  }

  function renderWithCopy(
    answer: (request: RecordedRequest) => Response | Promise<Response>,
  ) {
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      ...noProblemCheckRoute(plan),
      [`GET /api/plans/${copyId}`]: () => jsonResponse(200, copy),
      ...noProblemCheckRoute(copy),
      [`POST /api/plans/${id}/copies`]: answer,
    })
    return renderAppWithLocation(`/plans/${id}`)
  }

  it("opens the copy's page with 'Plan duplicated.'", async () => {
    const user = userEvent.setup()
    const { currentLocation } = renderWithCopy(() =>
      jsonResponse(201, {
        id: copyId,
        name: copy.name,
        locationName: "Kaunas",
        dates: copy.dates,
        savedAt: copy.savedAt,
      }),
    )

    await user.click(
      await screen.findByRole("button", {
        name: "Duplicate Weekend in Kaunas",
      }),
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Copy of Weekend in Kaunas",
      }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe(`/plans/${copyId}`)
    expect(screen.getByText("Plan duplicated.")).toHaveAttribute(
      "role",
      "status",
    )
  })

  it("stays on the page and says a plan deleted elsewhere no longer exists", async () => {
    const user = userEvent.setup()
    const { currentLocation } = renderWithCopy(() => jsonResponse(404, {}))

    await user.click(
      await screen.findByRole("button", {
        name: "Duplicate Weekend in Kaunas",
      }),
    )

    expect(
      await screen.findByText("This plan no longer exists."),
    ).toHaveAttribute("role", "alert")
    expect(currentLocation()).toBe(`/plans/${id}`)
  })
})

// Feature 011 User Story 3: Edit plan loads the saved plan into the planning steps.
describe("PlanDetailsPage edit", () => {
  const question =
    "Editing this plan replaces the plan you have not saved. Continue?"

  function renderWithPeriod(firstDate = "2026-11-19") {
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      ...noProblemCheckRoute(plan),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, { firstDate, lastDate: "2026-11-25", maxDates: 7 }),
    })
    return renderAppWithLocation(`/plans/${id}`)
  }

  it("offers Edit plan first among the plan's actions", async () => {
    renderWithPeriod()

    const actions = await screen.findByRole("button", { name: "Edit plan" })

    const buttons = within(actions.closest("p")!).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Edit plan",
      "Recalculate",
      "Rename",
      "Duplicate",
      "Delete",
    ])
  })

  it("loads the plan into Plan Setup and Activity Selection and starts the edit", async () => {
    const user = userEvent.setup()
    const { currentLocation } = renderWithPeriod()

    await user.click(await screen.findByRole("button", { name: "Edit plan" }))

    expect(currentLocation()).toBe("/plan/setup")
    expect(await screen.findByLabelText("Location")).toHaveValue(
      "Kaunas, Kaunas County",
    )
    expect(screen.getByText("Sat 21 Nov 2026")).toBeInTheDocument()
    expect(screen.getByText("Sun 22 Nov 2026")).toBeInTheDocument()
    expect(screen.getByLabelText(/Maximum travel distance/)).toHaveValue("30")
    expect(
      screen.getByText(
        "Editing 'Weekend in Kaunas'. Your saved plan is not changed until you save.",
      ),
    ).toBeInTheDocument()
    expect(
      usePlanActivitiesStore.getState().activities.map((a) => a.name),
    ).toEqual(["Cycling", "Museum"])
    expect(usePlanEditStore.getState().edit).toEqual({
      planId: id,
      planName: "Weekend in Kaunas",
      ownerEmail: "user@example.com",
    })
  })

  it("shows a saved date that has passed as in the past", async () => {
    const user = userEvent.setup()
    renderWithPeriod("2026-11-22")

    await user.click(await screen.findByRole("button", { name: "Edit plan" }))

    expect(
      await screen.findByText(/Dates cannot be in the past\./),
    ).toBeInTheDocument()
  })

  it("asks before replacing a plan in progress, and Cancel keeps it", async () => {
    const user = userEvent.setup()
    usePlanSetupStore.getState().setLocationText("Vilnius")
    usePlanSetupStore.getState().addDate("2026-11-24")
    const { currentLocation } = renderWithPeriod()
    const edit = await screen.findByRole("button", { name: "Edit plan" })

    await user.click(edit)
    const dialog = screen.getByRole("dialog", { name: question })
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(edit).toHaveFocus()
    expect(currentLocation()).toBe(`/plans/${id}`)
    expect(usePlanSetupStore.getState().dates).toEqual(["2026-11-24"])
    expect(usePlanEditStore.getState().edit).toBeNull()
  })

  it("replaces the plan in progress after Continue", async () => {
    const user = userEvent.setup()
    usePlanSetupStore.getState().addDate("2026-11-24")
    const { currentLocation } = renderWithPeriod()

    await user.click(await screen.findByRole("button", { name: "Edit plan" }))
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Continue",
      }),
    )

    expect(currentLocation()).toBe("/plan/setup")
    expect(usePlanSetupStore.getState().dates).toEqual(plan.dates)
  })

  it("does not ask after the plan in progress was saved and left unchanged", async () => {
    const user = userEvent.setup()
    // A date first: adding one unchecks the setup, so the plan is checked after it, as after Continue.
    usePlanSetupStore.getState().addDate("2026-11-14")
    acceptMuseumPlan()
    const { checked: setup } = usePlanSetupStore.getState()
    const { checked: activities } = usePlanActivitiesStore.getState()
    usePlanEditStore.getState().markSaved(setup!, activities!)
    const { currentLocation } = renderWithPeriod()

    await user.click(await screen.findByRole("button", { name: "Edit plan" }))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(currentLocation()).toBe("/plan/setup")
  })
})

// Feature 011 User Story 4: renaming a plan on its page.
describe("PlanDetailsPage rename", () => {
  function renderWithRename(
    answer: (request: RecordedRequest) => Response | Promise<Response>,
  ) {
    const routes = routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      ...noProblemCheckRoute(plan),
      [`PUT /api/plans/${id}/name`]: answer,
    })
    renderAppWithLocation(`/plans/${id}`)
    return routes
  }

  function renamedTo(name: string) {
    return jsonResponse(200, {
      id,
      name,
      locationName: "Kaunas",
      dates: plan.dates,
      savedAt: plan.savedAt,
    })
  }

  it("opens the form with the current name and focus in the field", async () => {
    const user = userEvent.setup()
    renderWithRename(() => renamedTo("Kaunas trip"))

    await user.click(await screen.findByRole("button", { name: "Rename" }))

    expect(
      screen.getByRole("form", { name: "Rename plan" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText("Plan name")).toHaveValue("Weekend in Kaunas")
    expect(screen.getByLabelText("Plan name")).toHaveFocus()
  })

  it("refuses an empty name next to the field, with focus on it each time", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithRename(() => renamedTo("x"))
    await user.click(await screen.findByRole("button", { name: "Rename" }))
    const field = screen.getByLabelText("Plan name")
    await user.clear(field)

    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(screen.getByText(/Enter a plan name\./)).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveFocus()

    screen.getByRole("button", { name: "Save" }).focus()
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(field).toHaveFocus()
    expect(requests.filter((request) => request.method === "PUT")).toEqual([])
  })

  it("renames the plan and updates the heading, title and breadcrumbs", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithRename(() => renamedTo("Kaunas trip"))
    await user.click(await screen.findByRole("button", { name: "Rename" }))
    const field = screen.getByLabelText("Plan name")
    await user.clear(field)
    await user.type(field, "Kaunas trip")

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("✓ Success: Plan renamed.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(
      screen.getByRole("heading", { level: 1, name: "Kaunas trip" }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Kaunas trip - Spėk laiku")
    expect(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByText(
        "Kaunas trip",
      ),
    ).toHaveAttribute("aria-current", "page")
    expect(
      screen.getByText("Saved on Wed 18 Nov 2026 at 14:05"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus()
    expect(requests.filter((request) => request.method === "PUT")).toEqual([
      {
        method: "PUT",
        path: `/api/plans/${id}/name`,
        body: { name: "Kaunas trip" },
      },
    ])
  })

  it("shows the pending text while renaming", async () => {
    const user = userEvent.setup()
    renderWithRename(() => new Promise<Response>(() => {}))
    await user.click(await screen.findByRole("button", { name: "Rename" }))

    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Renaming your plan…")).toHaveAttribute(
      "role",
      "status",
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
  })

  it("closes with Escape and returns focus to Rename, keeping the name", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithRename(() => renamedTo("x"))
    await user.click(await screen.findByRole("button", { name: "Rename" }))
    await user.type(screen.getByLabelText("Plan name"), " changed")

    await user.keyboard("{Escape}")

    expect(screen.queryByRole("form", { name: "Rename plan" })).toBeNull()
    expect(screen.getByRole("button", { name: "Rename" })).toHaveFocus()
    expect(
      screen.getByRole("heading", { level: 1, name: "Weekend in Kaunas" }),
    ).toBeInTheDocument()
    expect(requests.filter((request) => request.method === "PUT")).toEqual([])
  })

  it("shows the error with Retry and keeps the entered name", async () => {
    let calls = 0
    const user = userEvent.setup()
    renderWithRename(() =>
      ++calls === 1 ? jsonResponse(500) : renamedTo("Kaunas trip"),
    )
    await user.click(await screen.findByRole("button", { name: "Rename" }))
    const field = screen.getByLabelText("Plan name")
    await user.clear(field)
    await user.type(field, "Kaunas trip")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(
      await screen.findByText(/Error: Plan could not be renamed\. Try again\./),
    ).toHaveAttribute("role", "alert")
    expect(screen.getByLabelText("Plan name")).toHaveValue("Kaunas trip")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("✓ Success: Plan renamed."),
    ).toBeInTheDocument()
  })
})

// Feature 011 User Story 5: an ended session during a rename logs in again and comes back to this plan.
describe("PlanDetailsPage rename after the session ended", () => {
  it("opens Log in with the expired message and this plan as the return-to page", async () => {
    const user = userEvent.setup()
    let sessionEnded = false
    routeFetch({
      "GET /api/auth/me": () =>
        sessionEnded ? jsonResponse(401) : jsonResponse(200, signedInUser()),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      ...noProblemCheckRoute(plan),
      [`PUT /api/plans/${id}/name`]: () => {
        sessionEnded = true
        return jsonResponse(401)
      },
    })
    const { currentLocation } = renderAppWithLocation(`/plans/${id}`)
    await user.click(await screen.findByRole("button", { name: "Rename" }))

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(currentLocation()).toBe(
        `/login?returnTo=${encodeURIComponent(`/plans/${id}`)}`,
      ),
    )
    expect(
      screen.getByText("Your session has expired. Log in again."),
    ).toBeInTheDocument()
  })
})

// Feature 012 User Story 1: opening the plan checks it against the latest forecast.
describe("PlanDetailsPage plan check", () => {
  const wind = problem("wind", { time: "11:00", value: 9, limit: 8 })
  const windyCycling = planCheckWith(
    [
      {
        weather: {
          temperatureC: 6.5,
          rainMmPerHour: 0,
          windMs: 9,
          isIndoor: false,
        },
        problems: [wind],
      },
    ],
    plan,
  )

  function renderWithCheck(
    checkAnswer: (request: RecordedRequest) => Response | Promise<Response>,
  ) {
    return render(() => jsonResponse(200, plan), checkAnswer)
  }

  function entry(index: number) {
    return document.getElementById(`scheduled-entry-${index}`)
  }

  it("shows the saved plan at once and announces the check while it runs", async () => {
    renderWithCheck(() => new Promise<Response>(() => {}))

    await screen.findByRole("heading", { level: 1, name: "Weekend in Kaunas" })
    const region = screen.getByRole("region", { name: "Plan check" })
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Checking your plan against the latest forecast…",
    )
    expect(
      screen.getByText(
        "This is your plan as saved on Wed 18 Nov 2026. The forecast may have changed since.",
      ),
    ).toBeInTheDocument()
  })

  it("says the plan fits and when the forecast was received", async () => {
    const { requests } = renderWithCheck(() =>
      jsonResponse(200, planCheckWith([], plan)),
    )

    expect(
      await screen.findByText(
        "✓ No problems found. Your plan fits the current forecast.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Checked against the forecast updated at 14:05."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/This is your plan as saved on/)).toBeNull()
    expect(screen.queryByText("✗ Problem")).toBeNull()
    expect(requests.map((request) => request.path)).toContain(
      `/api/plans/${id}/check`,
    )
  })

  it("lists a problem, marks its entry and shows the latest weather", async () => {
    renderWithCheck(() => jsonResponse(200, windyCycling))

    expect(
      await screen.findByText("1 problem in 1 of 2 scheduled activities."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", {
        name: "Cycling, 2026-11-21 10:00–13:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
      }),
    ).toBeInTheDocument()
    const cycling = entry(0)!
    expect(cycling).toHaveTextContent("✗ Problem")
    expect(cycling).toHaveTextContent(
      "Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    )
    expect(cycling).toHaveTextContent("9 m/s wind, 0 mm/h rain, 6.5 °C")
    expect(cycling).not.toHaveTextContent("3.2 m/s wind")
    expect(entry(1)).not.toHaveTextContent("✗ Problem")
  })

  it("moves focus to the entry when a problem's link is followed", async () => {
    const user = userEvent.setup()
    renderWithCheck(() => jsonResponse(200, windyCycling))

    await user.click(await screen.findByRole("link", { name: /^Cycling, / }))

    expect(entry(0)).toHaveFocus()
  })

  it("loads the plan again when the check is of a newer version of it", async () => {
    let checks = 0
    const { requests } = renderWithCheck(() =>
      jsonResponse(
        200,
        // The first check finds a plan saved later (Save changes in another tab); the second matches.
        ++checks === 1
          ? { ...planCheckWith([], plan), savedAt: "2026-11-19T08:00:00Z" }
          : planCheckWith([], plan),
      ),
    )

    expect(
      await screen.findByText(
        "✓ No problems found. Your plan fits the current forecast.",
      ),
    ).toBeInTheDocument()
    const paths = requests.map((request) => request.path)
    expect(paths.filter((path) => path === `/api/plans/${id}`)).toHaveLength(2)
    expect(
      paths.filter((path) => path === `/api/plans/${id}/check`),
    ).toHaveLength(2)
  })

  it("loads the plan again only once when the versions still differ", async () => {
    const { requests } = renderWithCheck(() =>
      jsonResponse(200, {
        ...windyCycling,
        savedAt: "2026-11-19T08:00:00Z",
      }),
    )
    await screen.findByRole("heading", { level: 1, name: "Weekend in Kaunas" })

    await waitFor(() =>
      expect(
        requests.filter((request) => request.path === `/api/plans/${id}/check`),
      ).toHaveLength(2),
    )
    // Give a third request the chance to start; none may.
    await new Promise((resolve) => setTimeout(resolve, 50))

    const paths = requests.map((request) => request.path)
    expect(paths.filter((path) => path === `/api/plans/${id}`)).toHaveLength(2)
    expect(
      paths.filter((path) => path === `/api/plans/${id}/check`),
    ).toHaveLength(2)
    expect(screen.queryByText("✗ Problem")).toBeNull()
    expect(
      screen.getByText(
        "This is your plan as saved on Wed 18 Nov 2026. The forecast may have changed since.",
      ),
    ).toBeInTheDocument()
  })

  it("ignores a check answer that arrives after the page was left", async () => {
    const user = userEvent.setup()
    let answer: (response: Response) => void = () => {}
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () => jsonResponse(200, []),
      [`GET /api/plans/${id}`]: () => jsonResponse(200, plan),
      [`GET /api/plans/${id}/check`]: () =>
        new Promise<Response>((resolve) => (answer = resolve)),
    })
    const { currentLocation } = renderAppWithLocation(`/plans/${id}`)
    await screen.findByRole("heading", { level: 1, name: "Weekend in Kaunas" })

    await user.click(
      within(screen.getByRole("navigation", { name: "Breadcrumb" })).getByRole(
        "link",
        { name: "My plans" },
      ),
    )
    answer(jsonResponse(200, windyCycling))

    await waitFor(() => expect(currentLocation()).toBe("/plans"))
    expect(usePlanCheckStore.getState().status).toBe("idle")
    expect(usePlanCheckStore.getState().result).toBeNull()
  })
})

// Feature 012 User Story 2: Recalculate checks the plan again.
describe("PlanDetailsPage recalculate", () => {
  const rain = problem("rain", { time: "10:00", value: 2.5, limit: 1 })

  // The first check finds no problem; later ones wait for the test to release them.
  function renderRecalculate() {
    const later: ((response: Response) => void)[] = []
    let checks = 0
    const routes = render(
      () => jsonResponse(200, plan),
      () =>
        ++checks === 1
          ? jsonResponse(200, planCheckWith([], plan))
          : new Promise<Response>((resolve) => later.push(resolve)),
    )
    const checkRequests = () =>
      routes.requests.filter(
        (request) => request.path === `/api/plans/${id}/check`,
      )
    return { later, checkRequests }
  }

  it("offers Recalculate between Edit plan and Rename", async () => {
    renderRecalculate()

    const recalculate = await screen.findByRole("button", {
      name: "Recalculate",
    })

    const buttons = within(recalculate.closest("p")!).getAllByRole("button")
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Edit plan",
      "Recalculate",
      "Rename",
      "Duplicate",
      "Delete",
    ])
  })

  it("checks again, announces it and replaces the previous result", async () => {
    const user = userEvent.setup()
    const { later, checkRequests } = renderRecalculate()
    await screen.findByText(
      "✓ No problems found. Your plan fits the current forecast.",
    )

    await user.click(screen.getByRole("button", { name: "Recalculate" }))

    const region = screen.getByRole("region", { name: "Plan check" })
    expect(within(region).getByRole("status")).toHaveTextContent(
      "Checking your plan against the latest forecast…",
    )
    expect(checkRequests()).toHaveLength(2)
    later[0](jsonResponse(200, planCheckWith([{ problems: [rain] }], plan)))

    expect(
      await screen.findByText("1 problem in 1 of 2 scheduled activities."),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(
        "✓ No problems found. Your plan fits the current forecast.",
      ),
    ).toBeNull()
  })

  it("is disabled while checking, so selecting it twice sends one check", async () => {
    const user = userEvent.setup()
    const { later, checkRequests } = renderRecalculate()
    await screen.findByText(
      "✓ No problems found. Your plan fits the current forecast.",
    )
    const recalculate = screen.getByRole("button", { name: "Recalculate" })

    await user.click(recalculate)
    expect(recalculate).toBeDisabled()
    await user.click(recalculate)

    expect(checkRequests()).toHaveLength(2)
    later[0](jsonResponse(200, planCheckWith([], plan)))
    await waitFor(() => expect(recalculate).toBeEnabled())
  })

  it("gives focus back to Recalculate when the check has ended", async () => {
    const user = userEvent.setup()
    const { later } = renderRecalculate()
    await screen.findByText(
      "✓ No problems found. Your plan fits the current forecast.",
    )
    const recalculate = screen.getByRole("button", { name: "Recalculate" })

    await user.click(recalculate)
    later[0](jsonResponse(200, planCheckWith([], plan)))

    await waitFor(() => expect(recalculate).toHaveFocus())
  })
})

// Feature 012 User Story 3: each problem gives its reason.
describe("PlanDetailsPage problem reasons", () => {
  const wind = problem("wind", { time: "11:00", value: 9, limit: 8 })
  const overlap = problem("overlap", {
    otherActivityName: "Museum",
    otherStartTime: "12:00",
    otherEndTime: "14:00",
  })
  const travel = problem("travel", {
    value: 34.2,
    limit: 30,
    fromPlaceName: "Kaunas Castle",
  })
  const noForecast = problem("noForecast", { time: "15:00" })

  // The plan with a third entry, Cycling again on the second date.
  const twoDatePlan: SavedPlan = {
    ...plan,
    scheduled: [
      ...plan.scheduled,
      { ...plan.scheduled[0], date: "2026-11-22", startTime: "09:00" },
    ],
  }

  function entry(index: number) {
    return document.getElementById(`scheduled-entry-${index}`)!
  }

  it("shows each reason of an entry with several problems", async () => {
    render(
      () => jsonResponse(200, plan),
      () =>
        jsonResponse(
          200,
          planCheckWith([{ problems: [wind, overlap, travel] }], plan),
        ),
    )

    expect(
      await screen.findByText("3 problems in 1 of 2 scheduled activities."),
    ).toBeInTheDocument()
    const cycling = entry(0)
    expect(within(cycling).getAllByText("✗ Problem")).toHaveLength(1)
    expect(cycling).toHaveTextContent(
      "Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    )
    expect(cycling).toHaveTextContent("Overlaps with Museum (12:00–14:00).")
    expect(cycling).toHaveTextContent(
      "Travel of 34.2 km from Kaunas Castle, more than your 30 km limit.",
    )
  })

  it("lists the problems over two dates in date and start time order", async () => {
    render(
      () => jsonResponse(200, twoDatePlan),
      () =>
        jsonResponse(
          200,
          planCheckWith(
            [
              { problems: [wind] },
              { problems: [noForecast] },
              { date: "2026-11-22", startTime: "09:00", problems: [wind] },
            ],
            twoDatePlan,
          ),
        ),
    )

    await screen.findByText("3 problems in 3 of 3 scheduled activities.")
    const region = screen.getByRole("region", { name: "Plan check" })
    expect(
      within(region)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([
      "Cycling, 2026-11-21 10:00–13:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
      "Museum, 2026-11-21 14:00–16:00: No forecast for 15:00.",
      "Cycling, 2026-11-22 09:00–13:00: Wind up to 9 m/s at 11:00, more than your limit of 8 m/s.",
    ])
  })

  it("shows the activities that could not be scheduled exactly as saved", async () => {
    render(
      () => jsonResponse(200, plan),
      () => jsonResponse(200, planCheckWith([{ problems: [wind] }], plan)),
    )

    await screen.findByText("1 problem in 1 of 2 scheduled activities.")
    const unscheduled = screen.getByRole("region", {
      name: "Could not be scheduled",
    })
    expect(within(unscheduled).getByRole("listitem")).toHaveTextContent(
      "Kayaking: No suitable time found",
    )
    expect(unscheduled).not.toHaveTextContent("✗ Problem")
    expect(unscheduled).not.toHaveTextContent("Already past. Not checked.")
  })
})

// Feature 012 User Story 4: a failed check keeps the saved plan on screen as saved.
describe("PlanDetailsPage check failures", () => {
  const savedNote =
    "This is your plan as saved on Wed 18 Nov 2026. The forecast may have changed since."
  const wind = problem("wind", { time: "11:00", value: 9, limit: 8 })

  function entry(index: number) {
    return document.getElementById(`scheduled-entry-${index}`)!
  }

  function expectPlanAsSaved() {
    expect(screen.getByText(savedNote)).toBeInTheDocument()
    // The saved weather of Cycling, not a newer one. Without a check the entries have no ids.
    expect(screen.getByText("Cycling").closest("li")).toHaveTextContent("3.2 m/s wind, 0 mm/h rain, 8.5 °C")
    expect(screen.queryByText("✗ Problem")).toBeNull()
    const region = screen.getByRole("region", { name: "Plan check" })
    expect(within(region).queryAllByRole("link")).toHaveLength(0)
    expect(within(region).getByRole("status")).toHaveTextContent("")
  }

  it.each([
    [
      "the weather service failed",
      () =>
        jsonResponse(503, {
          status: 503,
          title: "Service unavailable.",
          detail: "The weather service is unavailable. No forecast is shown.",
          service: "forecast",
        }),
      "Error: The forecast could not be updated. Your saved plan is unchanged.",
    ],
    [
      "the server failed",
      () => jsonResponse(500, { status: 500, title: "Server error." }),
      "Error: Something went wrong. Try again.",
    ],
    [
      "the request limit was reached",
      () =>
        jsonResponse(429, {
          status: 429,
          title: "Too many requests.",
          detail: "Too many requests. Wait a minute and try again.",
        }),
      "Error: Too many requests. Wait a minute and try again.",
    ],
  ])(
    "shows the error with Retry and the plan as saved when %s",
    async (_, answer, message) => {
      render(() => jsonResponse(200, plan), answer)

      expect(await screen.findByRole("alert")).toHaveTextContent(message)
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
      expectPlanAsSaved()
    },
  )

  it("shows the result when Retry succeeds after a weather failure", async () => {
    const user = userEvent.setup()
    let checks = 0
    render(
      () => jsonResponse(200, plan),
      () =>
        ++checks === 1
          ? jsonResponse(503, { status: 503, service: "forecast" })
          : jsonResponse(200, planCheckWith([{ problems: [wind] }], plan)),
    )

    await user.click(await screen.findByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("1 problem in 1 of 2 scheduled activities."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
    expect(checks).toBe(2)
  })

  it("shows the plan as saved again when Recalculate fails after a successful check", async () => {
    const user = userEvent.setup()
    let checks = 0
    render(
      () => jsonResponse(200, plan),
      () =>
        ++checks === 1
          ? jsonResponse(
              200,
              planCheckWith(
                [
                  {
                    weather: {
                      temperatureC: 6.5,
                      rainMmPerHour: 0,
                      windMs: 9,
                      isIndoor: false,
                    },
                    problems: [wind],
                  },
                ],
                plan,
              ),
            )
          : jsonResponse(503, { status: 503, service: "forecast" }),
    )
    await screen.findByText("1 problem in 1 of 2 scheduled activities.")
    expect(entry(0)).toHaveTextContent("9 m/s wind, 0 mm/h rain, 6.5 °C")

    await user.click(screen.getByRole("button", { name: "Recalculate" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Error: The forecast could not be updated. Your saved plan is unchanged.",
    )
    expectPlanAsSaved()
  })
})
