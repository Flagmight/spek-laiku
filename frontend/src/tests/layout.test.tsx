import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import {
  jsonResponse,
  renderApp,
  routeFetch,
  signedInUser,
  stubFetch,
} from "./renderApp"
import { forecastRoutes } from "./forecastFixtures"

describe("shared layout", () => {
  beforeEach(() => {
    stubFetch(() => jsonResponse(401))
  })

  it("renders the home page at /", async () => {
    renderApp("/")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content")
  })

  it("shows a banner message passed as router state until it is dismissed", async () => {
    const user = userEvent.setup()
    renderApp({ pathname: "/", state: { successMessage: "Account created." } })

    expect(
      await screen.findByText("✓ Success: Account created."),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Dismiss" }))

    expect(
      screen.queryByText("✓ Success: Account created."),
    ).not.toBeInTheDocument()
  })

  it("shows no banner without a message", async () => {
    renderApp("/")

    await screen.findByRole("heading", { level: 1 })
    expect(screen.queryByText(/Success:/)).not.toBeInTheDocument()
  })

  it.each(["/", "/register", "/login"])(
    "makes 'Skip to main content' the first focusable item on %s",
    async (path) => {
      const user = userEvent.setup()
      renderApp(path)

      await user.tab()

      expect(
        screen.getByRole("link", { name: "Skip to main content" }),
      ).toHaveFocus()
    },
  )

  it("makes 'Skip to main content' the first focusable item on the Account Suspended page", async () => {
    stubFetch(() =>
      jsonResponse(200, {
        email: "user@example.com",
        role: "Registered User",
        accountStatus: "Suspended",
      }),
    )
    const user = userEvent.setup()
    renderApp("/account-suspended")
    await screen.findByRole("heading", { level: 1, name: "Account suspended" })

    await user.tab()

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus()
  })

  it("moves focus to the main content when the skip link is selected", async () => {
    const user = userEvent.setup()
    renderApp("/")

    await user.tab()
    await user.keyboard("{Enter}")

    expect(screen.getByRole("main")).toHaveFocus()
  })
})

describe.each([
  ["Administrator", "Activity categories"],
  ["Registered User", "Access denied"],
])("skip link on /admin/categories for a %s", (role, heading) => {
  it(`makes 'Skip to main content' the first focusable item on the ${heading} page`, async () => {
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () => jsonResponse(200, signedInUser(role)),
      "GET /api/admin/categories": () => jsonResponse(200, []),
    })
    const user = userEvent.setup()
    renderApp("/admin/categories")
    await screen.findByRole("heading", { level: 1, name: heading })

    await user.tab()

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus()
  })
})

describe.each([
  ["/plan/setup", "Plan setup"],
  ["/plan/activities", "Activity selection"],
  ["/plan/places", "Places and forecast"],
])("skip link on %s", (page, heading) => {
  it(`makes 'Skip to main content' the first focusable item on the ${heading} page`, async () => {
    usePlanActivitiesStore.getState().setChecked([])
    usePlanSetupStore.getState().setChecked({
      location: {
        id: 598316,
        name: "Kaunas",
        area: "Kaunas County",
        latitude: 54.90156,
        longitude: 23.90909,
      },
      dates: ["2026-11-07"],
      maxTravelDistanceKm: 30,
    })
    routeFetch({
      ...forecastRoutes,
      "GET /api/auth/me": () => jsonResponse(401),
      "GET /api/plan-setup/period": () =>
        jsonResponse(200, {
          firstDate: "2026-11-04",
          lastDate: "2026-11-10",
          maxDates: 7,
        }),
      "GET /api/plan-activities/categories": () =>
        jsonResponse(200, { categories: [], maxActivities: 10 }),
    })
    const user = userEvent.setup()
    renderApp(page)
    await screen.findByRole("heading", { level: 1, name: heading })

    await user.tab()

    expect(
      screen.getByRole("link", { name: "Skip to main content" }),
    ).toHaveFocus()
  })
})
