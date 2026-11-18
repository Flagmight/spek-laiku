import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { SavedPlanSummary } from "../types/savedPlan"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

const plans: SavedPlanSummary[] = [
  {
    id: "plan-3",
    name: "Weekend in Kaunas",
    locationName: "Kaunas",
    dates: ["2026-11-21", "2026-11-22"],
    savedAt: "2026-11-18T12:05:00Z",
  },
  {
    id: "plan-2",
    name: "Vilnius museums",
    locationName: "Vilnius",
    dates: ["2026-11-25"],
    savedAt: "2026-11-17T09:30:00Z",
  },
  {
    id: "plan-1",
    name: "<script>alert(1)</script>",
    locationName: "Klaipėda",
    dates: ["2026-11-20"],
    savedAt: "2026-11-16T18:00:00Z",
  },
]

function render(
  list: (request: RecordedRequest) => Response | Promise<Response>,
) {
  routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
    "GET /api/plans": list,
  })
  return renderAppWithLocation("/plans")
}

describe("MyPlansPage", () => {
  it("has one heading and the tab title", async () => {
    render(() => jsonResponse(200, plans))

    expect(
      await screen.findByRole("heading", { level: 1, name: "My plans" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("My plans - Spėk laiku")
  })

  it("shows and announces the loading state", async () => {
    render(() => new Promise<Response>(() => {}))

    const loading = await screen.findByText("Loading your plans…")
    expect(loading.closest('[role="status"]')).not.toBeNull()
  })

  it("shows the empty state with a New plan button", async () => {
    render(() => jsonResponse(200, []))

    expect(await screen.findByText("No saved plans yet.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "New plan" })).toHaveAttribute(
      "href",
      "/plan/setup",
    )
  })

  it("lists the plans in the server's order with location, dates and saved time", async () => {
    render(() => jsonResponse(200, plans))

    const table = await screen.findByRole("table", { name: "Your saved plans" })
    const rows = within(table).getAllByRole("row").slice(1)
    expect(
      rows.map((row) => within(row).getByRole("rowheader").textContent),
    ).toEqual([
      "Weekend in Kaunas",
      "Vilnius museums",
      "<script>alert(1)</script>",
    ])
    expect(rows[0]).toHaveTextContent("Kaunas")
    expect(rows[0]).toHaveTextContent("Sat 21 Nov, Sun 22 Nov")
    expect(rows[0]).toHaveTextContent("Saved on Wed 18 Nov 2026 at 14:05")
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Plan", "Location", "Dates", "Saved", "Actions"])
  })

  it("names each Open link after its plan and links to the plan page", async () => {
    render(() => jsonResponse(200, plans))

    const open = await screen.findByRole("link", {
      name: "Open Weekend in Kaunas",
    })
    expect(open).toHaveTextContent("Open")
    expect(open).toHaveAttribute("href", "/plans/plan-3")
  })

  it("shows a plan name as plain text", async () => {
    render(() => jsonResponse(200, plans))

    expect(
      await screen.findByRole("rowheader", {
        name: "<script>alert(1)</script>",
      }),
    ).toBeInTheDocument()
    expect(document.querySelector("tbody script")).toBeNull()
  })

  it("shows the server error with Retry, which loads again", async () => {
    let calls = 0
    const user = userEvent.setup()
    render(() => (++calls === 1 ? jsonResponse(500) : jsonResponse(200, plans)))

    expect(
      await screen.findByText(/Error: Saved plans could not be loaded\./),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByRole("rowheader", { name: "Weekend in Kaunas" }),
    ).toBeInTheDocument()
    expect(calls).toBe(2)
  })

  it("sends a Visitor to Log in with this page as the return-to page", async () => {
    routeFetch({ "GET /api/auth/me": () => jsonResponse(401) })
    const { currentLocation } = renderAppWithLocation("/plans")

    await waitFor(() =>
      expect(currentLocation()).toBe("/login?returnTo=%2Fplans"),
    )
    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()
  })
})
