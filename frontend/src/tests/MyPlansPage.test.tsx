import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { usePlanEditStore } from "../stores/usePlanEditStore"
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

// Feature 011 User Story 1: deleting a plan from My plans, after confirmation.
describe("MyPlansPage delete", () => {
  const question = "Delete 'Weekend in Kaunas'? This cannot be undone."

  function renderWithDelete(
    answer: (request: RecordedRequest) => Response | Promise<Response>,
    list: SavedPlanSummary[] = plans,
  ) {
    const routes = routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () => jsonResponse(200, list),
      "DELETE /api/plans/plan-3": answer,
      "DELETE /api/plans/plan-1": answer,
    })
    renderAppWithLocation("/plans")
    return routes
  }

  function deleteRequests(requests: RecordedRequest[]) {
    return requests.filter((request) => request.method === "DELETE")
  }

  it("names each Delete button after its plan", async () => {
    renderWithDelete(() => jsonResponse(204))

    for (const plan of plans) {
      expect(
        await screen.findByRole("button", { name: `Delete ${plan.name}` }),
      ).toHaveTextContent("Delete")
    }
  })

  it("asks for confirmation before deleting", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithDelete(() => jsonResponse(204))

    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    const dialog = screen.getByRole("dialog", { name: question })
    expect(within(dialog).getByRole("button", { name: "Delete" })).toHaveFocus()
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument()
    expect(deleteRequests(requests)).toEqual([])
  })

  it.each(["Cancel", "Escape"])(
    "deletes nothing on %s and returns focus to the Delete button",
    async (how) => {
      const user = userEvent.setup()
      const { requests } = renderWithDelete(() => jsonResponse(204))
      const deleteButton = await screen.findByRole("button", {
        name: "Delete Weekend in Kaunas",
      })
      await user.click(deleteButton)

      if (how === "Cancel") {
        await user.click(screen.getByRole("button", { name: "Cancel" }))
      } else {
        await user.keyboard("{Escape}")
      }

      expect(screen.queryByRole("dialog")).toBeNull()
      expect(deleteButton).toHaveFocus()
      expect(deleteRequests(requests)).toEqual([])
      expect(
        screen.getByRole("rowheader", { name: "Weekend in Kaunas" }),
      ).toBeInTheDocument()
    },
  )

  it("deletes the plan, announces it and moves focus to the next plan", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithDelete(() => jsonResponse(204))
    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    expect(await screen.findByText("Plan deleted.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(
      screen.queryByRole("rowheader", { name: "Weekend in Kaunas" }),
    ).toBeNull()
    expect(
      screen.getByRole("link", { name: "Open Vilnius museums" }),
    ).toHaveFocus()
    expect(deleteRequests(requests)).toEqual([
      { method: "DELETE", path: "/api/plans/plan-3", body: undefined },
    ])
  })

  it("moves focus to the heading after deleting the last plan in the list", async () => {
    const user = userEvent.setup()
    renderWithDelete(() => jsonResponse(204))
    await user.click(
      await screen.findByRole("button", {
        name: "Delete <script>alert(1)</script>",
      }),
    )

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    await screen.findByText("Plan deleted.")
    expect(
      screen.getByRole("heading", { level: 1, name: "My plans" }),
    ).toHaveFocus()
  })

  it("shows the empty state after deleting the only plan", async () => {
    const user = userEvent.setup()
    renderWithDelete(() => jsonResponse(204), [plans[0]])
    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    expect(await screen.findByText("No saved plans yet.")).toBeInTheDocument()
    expect(screen.getByText("Plan deleted.")).toBeInTheDocument()
  })

  it("shows the pending text and disables the button while deleting", async () => {
    const user = userEvent.setup()
    renderWithDelete(() => new Promise<Response>(() => {}))
    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    expect(await screen.findByText("Deleting your plan…")).toHaveAttribute(
      "role",
      "status",
    )
    expect(
      screen.getByRole("button", { name: "Delete Weekend in Kaunas" }),
    ).toBeDisabled()
  })

  it("keeps the plan and offers Retry after a server error", async () => {
    let calls = 0
    const user = userEvent.setup()
    renderWithDelete(() =>
      ++calls === 1 ? jsonResponse(500) : jsonResponse(204),
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
      await screen.findByText(/Error: Plan could not be deleted\. Try again\./),
    ).toHaveAttribute("role", "alert")
    expect(
      screen.getByRole("rowheader", { name: "Weekend in Kaunas" }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Plan deleted.")).toBeInTheDocument()
    expect(
      screen.queryByRole("rowheader", { name: "Weekend in Kaunas" }),
    ).toBeNull()
    expect(calls).toBe(2)
  })

  it("removes a plan that was already deleted and says it no longer exists", async () => {
    const user = userEvent.setup()
    renderWithDelete(() =>
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
    expect(
      screen.queryByRole("rowheader", { name: "Weekend in Kaunas" }),
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull()
  })
})

// Feature 011 User Story 2: duplicating a plan from My plans.
describe("MyPlansPage duplicate", () => {
  const copy: SavedPlanSummary = {
    ...plans[1],
    id: "plan-copy",
    name: "Copy of Vilnius museums",
  }

  function renderWithCopy(
    answer: (request: RecordedRequest) => Response | Promise<Response>,
  ) {
    const routes = routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () => jsonResponse(200, plans),
      "POST /api/plans/plan-2/copies": answer,
    })
    renderAppWithLocation("/plans")
    return routes
  }

  function rowNames() {
    return within(screen.getByRole("table", { name: "Your saved plans" }))
      .getAllByRole("rowheader")
      .map((header) => header.textContent)
  }

  it("copies the plan without a body and lists the copy directly above its original", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithCopy(() => jsonResponse(201, copy))

    await user.click(
      await screen.findByRole("button", { name: "Duplicate Vilnius museums" }),
    )

    expect(await screen.findByText("Plan duplicated.")).toHaveAttribute(
      "role",
      "status",
    )
    expect(rowNames()).toEqual([
      "Weekend in Kaunas",
      "Copy of Vilnius museums",
      "Vilnius museums",
      "<script>alert(1)</script>",
    ])
    expect(requests.filter((request) => request.method === "POST")).toEqual([
      { method: "POST", path: "/api/plans/plan-2/copies", body: undefined },
    ])
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("sends one request for a double click and shows the pending text", async () => {
    const user = userEvent.setup()
    const { requests } = renderWithCopy(() => new Promise<Response>(() => {}))
    const duplicate = await screen.findByRole("button", {
      name: "Duplicate Vilnius museums",
    })

    await user.dblClick(duplicate)

    expect(await screen.findByText("Duplicating your plan…")).toHaveAttribute(
      "role",
      "status",
    )
    expect(duplicate).toBeDisabled()
    expect(
      requests.filter((request) => request.method === "POST"),
    ).toHaveLength(1)
  })

  it("shows the error with Retry, which lists the copy once it succeeds", async () => {
    let calls = 0
    const user = userEvent.setup()
    renderWithCopy(() =>
      ++calls === 1 ? jsonResponse(500) : jsonResponse(201, copy),
    )
    await user.click(
      await screen.findByRole("button", { name: "Duplicate Vilnius museums" }),
    )

    expect(
      await screen.findByText(
        /Error: Plan could not be duplicated\. Try again\./,
      ),
    ).toHaveAttribute("role", "alert")
    expect(rowNames()).not.toContain("Copy of Vilnius museums")

    await user.click(screen.getByRole("button", { name: "Retry" }))

    expect(await screen.findByText("Plan duplicated.")).toBeInTheDocument()
    expect(rowNames()).toContain("Copy of Vilnius museums")
  })

  it("removes a plan that was deleted elsewhere and says it no longer exists", async () => {
    const user = userEvent.setup()
    renderWithCopy(() => jsonResponse(404, {}))

    await user.click(
      await screen.findByRole("button", { name: "Duplicate Vilnius museums" }),
    )

    expect(
      await screen.findByText("This plan no longer exists."),
    ).toHaveAttribute("role", "alert")
    expect(rowNames()).not.toContain("Vilnius museums")
  })
})

// Feature 011 spec Edge Cases: deleting the plan that is being edited in this tab ends the edit.
describe("MyPlansPage delete while editing", () => {
  it("ends an edit of the deleted plan and keeps an edit of another plan", async () => {
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () => jsonResponse(200, plans),
      "DELETE /api/plans/plan-3": () => jsonResponse(204),
      "DELETE /api/plans/plan-2": () => jsonResponse(204),
    })
    usePlanEditStore.getState().start({
      planId: "plan-2",
      planName: "Vilnius museums",
      ownerEmail: "user@example.com",
    })
    renderAppWithLocation("/plans")

    await user.click(
      await screen.findByRole("button", { name: "Delete Weekend in Kaunas" }),
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )
    await screen.findByText("Plan deleted.")
    expect(usePlanEditStore.getState().edit?.planId).toBe("plan-2")

    await user.click(
      screen.getByRole("button", { name: "Delete Vilnius museums" }),
    )
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete",
      }),
    )

    await waitFor(() => expect(usePlanEditStore.getState().edit).toBeNull())
  })
})

// Feature 011 code review: one plan action runs at a time on the page, so another plan's actions wait instead of
// being ignored without a message.
describe("MyPlansPage while an action is running", () => {
  it("disables every plan's actions until the running one ends", async () => {
    const user = userEvent.setup()
    routeFetch({
      "GET /api/auth/me": () => jsonResponse(200, signedInUser()),
      "GET /api/plans": () => jsonResponse(200, plans),
      "POST /api/plans/plan-2/copies": () => new Promise<Response>(() => {}),
    })
    renderAppWithLocation("/plans")

    await user.click(
      await screen.findByRole("button", { name: "Duplicate Vilnius museums" }),
    )

    expect(
      screen.getByRole("button", { name: "Delete Weekend in Kaunas" }),
    ).toBeDisabled()
    expect(
      screen.getByRole("button", { name: "Duplicate Weekend in Kaunas" }),
    ).toBeDisabled()
  })
})
