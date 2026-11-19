import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import type { SavedPlanSummary } from "../types/savedPlan"
import {
  jsonResponse,
  renderApp,
  routeFetch,
  signedInUser,
  stubFetch,
} from "./renderApp"

describe("HomePage", () => {
  beforeEach(() => {
    stubFetch(() => jsonResponse(401))
    document.title = ""
  })

  it("sets the tab title to 'Home - Spėk laiku'", async () => {
    renderApp("/")

    await waitFor(() => expect(document.title).toBe("Home - Spėk laiku"))
  })

  it("has exactly one h1, 'Spėk laiku'", async () => {
    renderApp("/")

    await screen.findByRole("heading", { level: 1 })
    const headings = screen.getAllByRole("heading", { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent("Spėk laiku")
  })
})

describe("HomePage Create plan button", () => {
  it("takes a visitor to the Plan setup page", async () => {
    stubFetch(() => jsonResponse(401))
    const user = userEvent.setup()
    renderApp("/")

    const createPlan = await within(screen.getByRole("main")).findByRole(
      "link",
      { name: "Create plan" },
    )
    expect(createPlan).toHaveAttribute("href", "/plan/setup")
    await user.click(createPlan)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Plan setup" }),
    ).toBeInTheDocument()
  })
})

describe("HomePage Create plan button by role", () => {
  it.each([
    ["Registered User", "Active", true],
    ["Registered User", "Suspended", false],
    ["Administrator", "Active", false],
    ["Administrator", "Suspended", false],
  ])("for a %s (%s) is shown: %s", async (role, accountStatus, shown) => {
    stubFetch(() =>
      jsonResponse(200, { email: "user@example.com", role, accountStatus }),
    )
    renderApp("/")

    await screen.findByRole("button", { name: "Log out" })

    expect(
      within(screen.getByRole("main")).queryByRole("link", {
        name: "Create plan",
      }) !== null,
    ).toBe(shown)
  })
})

// Feature 010 spec User Story 6, FR-011.
describe("HomePage saved plans block", () => {
  const plans: SavedPlanSummary[] = Array.from({ length: 7 }, (_, index) => ({
    id: `plan-${7 - index}`,
    name: `Plan ${7 - index}`,
    locationName: "Kaunas",
    dates: ["2026-11-21"],
    savedAt: `2026-11-1${7 - index}T12:00:00Z`,
  }))

  // The block appears once the signed-in state has loaded.
  async function render(list: () => Response | Promise<Response>) {
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": list,
    })
    renderApp("/")
    await screen.findByRole("region", { name: "Your saved plans" })
  }

  function block() {
    return within(screen.getByRole("region", { name: "Your saved plans" }))
  }

  it("shows the five most recently saved plans and All my plans", async () => {
    await render(() => jsonResponse(200, plans))

    const table = await block().findByRole("table")
    const names = within(table)
      .getAllByRole("rowheader")
      .map((header) => header.textContent)
    expect(names).toEqual(["Plan 7", "Plan 6", "Plan 5", "Plan 4", "Plan 3"])
    expect(block().getByRole("link", { name: "Open Plan 7" })).toHaveAttribute(
      "href",
      "/plans/plan-7",
    )
    expect(block().getByRole("link", { name: "All my plans" })).toHaveAttribute(
      "href",
      "/plans",
    )
  })

  it("offers only Open, without Duplicate or Delete (feature 011 FR-019)", async () => {
    await render(() => jsonResponse(200, plans))

    await block().findByRole("table")
    expect(block().queryByRole("button", { name: /^Delete/ })).toBeNull()
    expect(block().queryByRole("button", { name: /^Duplicate/ })).toBeNull()
  })

  it("shows the loading state inside the block only", async () => {
    await render(() => new Promise<Response>(() => {}))

    const loading = await block().findByText("Loading your saved plans…")
    expect(loading).toHaveAttribute("role", "status")
    expect(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Create plan",
      }),
    ).toBeInTheDocument()
  })

  it("shows the empty state with Create your first plan", async () => {
    await render(() => jsonResponse(200, []))

    expect(await block().findByText("No saved plans yet.")).toBeInTheDocument()
    expect(
      block().getByRole("link", { name: "Create your first plan" }),
    ).toHaveAttribute("href", "/plan/setup")
  })

  it("shows the error with Retry, and the rest of Home still works", async () => {
    let calls = 0
    const user = userEvent.setup()
    await render(() =>
      ++calls === 1 ? jsonResponse(500) : jsonResponse(200, plans),
    )

    expect(
      await block().findByText(/Error: Saved plans could not be loaded\./),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole("main")).getByRole("link", {
        name: "Create plan",
      }),
    ).toBeInTheDocument()

    await user.click(block().getByRole("button", { name: "Retry" }))

    expect(
      await block().findByRole("rowheader", { name: "Plan 7" }),
    ).toBeInTheDocument()
  })

  it.each([
    ["a Visitor", null],
    ["an Active Administrator", signedInUser("Administrator", "Active")],
    [
      "a Suspended Registered User",
      signedInUser("Registered User", "Suspended"),
    ],
  ])("is not shown to %s and asks for no plans", async (_who, user) => {
    const { requests } = routeFetch({
      "GET /api/auth/me": () =>
        user ? jsonResponse(200, user) : jsonResponse(401),
    })
    renderApp("/")

    await screen.findByRole("heading", { level: 1 })
    await waitFor(() =>
      expect(requests.map((request) => request.path)).toContain("/api/auth/me"),
    )
    expect(
      screen.queryByRole("region", { name: "Your saved plans" }),
    ).not.toBeInTheDocument()
    expect(requests.map((request) => request.path)).not.toContain("/api/plans")
  })
})
