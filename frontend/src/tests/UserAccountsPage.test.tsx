import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import {
  accountList,
  activeUser,
  administrator,
  suspendedAdministrator,
  suspendedUser,
  withStatus,
} from "./adminAccountsFixtures"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

type Handler = (request: RecordedRequest) => Response | Promise<Response>

const listRoute = "GET /api/admin/accounts"
const statusRoute = (id: string) => `PUT /api/admin/accounts/${id}/status`

function render(
  handlers: Record<string, Handler> = {},
  me?: () => CurrentUser,
) {
  const routes = routeFetch({
    "GET /api/auth/me": () =>
      jsonResponse(200, me ? me() : signedInUser("Administrator")),
    [listRoute]: () => jsonResponse(200, accountList()),
    ...handlers,
  })
  renderAppWithLocation("/admin/users")
  return routes
}

async function table() {
  return screen.findByRole("table", { name: "User accounts" })
}

// The page's own status region; the layout has another one outside main.
function status() {
  return within(screen.getByRole("main")).getByRole("status")
}

// The User accounts page (feature 014 spec User Story 1, FR-001, FR-003, FR-004, FR-006, FR-012, FR-013, FR-019).
describe("UserAccountsPage: list", () => {
  it("has one heading and the tab title", async () => {
    render()

    expect(
      await screen.findByRole("heading", { level: 1, name: "User accounts" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("User accounts - Spėk laiku")
  })

  it("lists each account with its role, status as a word and registration date", async () => {
    render()

    const rows = within(await table())
      .getAllByRole("row")
      .slice(1)
    expect(rows).toHaveLength(4)
    expect(within(rows[0]!).getByRole("rowheader")).toHaveTextContent(
      "ana@example.com",
    )
    expect(rows[0]).toHaveTextContent("Registered User")
    expect(rows[0]).toHaveTextContent("Active")
    expect(rows[0]).toHaveTextContent("Sat 21 Nov 2026")
    expect(rows[1]).toHaveTextContent("Suspended")
  })

  it("offers Suspend only on the Active Registered User and no button on Administrator accounts", async () => {
    render()
    const rows = within(await table())
      .getAllByRole("row")
      .slice(1)

    expect(
      within(rows[0]!).getByRole("button", { name: "Suspend ana@example.com" }),
    ).toHaveTextContent("Suspend")
    expect(within(rows[2]!).queryByRole("button")).toBeNull()
    expect(within(rows[3]!).queryByRole("button")).toBeNull()
    expect(administrator.role).toBe("Administrator")
    expect(suspendedAdministrator.role).toBe("Administrator")
  })

  it("shows and announces the loading state", async () => {
    render({ [listRoute]: () => new Promise<Response>(() => {}) })

    const loading = await screen.findByText("Loading accounts…")
    expect(loading.closest('[role="status"]')).not.toBeNull()
  })

  it("shows the load error with Retry, which loads the list again", async () => {
    let fail = true
    render({
      [listRoute]: () =>
        fail ? jsonResponse(500, {}) : jsonResponse(200, accountList()),
    })

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Error: Accounts could not be loaded.")
    fail = false
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))

    expect(await table()).toBeInTheDocument()
  })
})

describe("UserAccountsPage: suspend", () => {
  it("asks before suspending, and Cancel sends nothing and returns focus", async () => {
    const { requests } = render()
    await table()
    const suspend = screen.getByRole("button", {
      name: "Suspend ana@example.com",
    })

    await userEvent.click(suspend)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveTextContent(
      "Suspend ana@example.com? They will lose access until reactivated.",
    )
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    )

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(suspend).toHaveFocus()
    expect(requests.filter((request) => request.method === "PUT")).toEqual([])
  })

  it("closes the dialog with Escape without a change", async () => {
    const { requests } = render()
    await table()
    const suspend = screen.getByRole("button", {
      name: "Suspend ana@example.com",
    })

    await userEvent.click(suspend)
    await userEvent.keyboard("{Escape}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(suspend).toHaveFocus()
    expect(requests.filter((request) => request.method === "PUT")).toEqual([])
  })

  it("suspends after the confirmation, announces it and moves focus to the account's new button", async () => {
    const { requests } = render({
      [statusRoute(activeUser.id)]: () =>
        jsonResponse(200, withStatus(activeUser, "Suspended")),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )

    await waitFor(() =>
      expect(status()).toHaveTextContent("✓ Success: Account suspended."),
    )
    const puts = requests.filter((request) => request.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(puts[0]?.body).toEqual({ accountStatus: "Suspended" })
    expect(screen.queryByRole("dialog")).toBeNull()
    const row = within(await table()).getAllByRole("row")[1]!
    expect(row).toHaveTextContent("Suspended")
    await waitFor(() =>
      expect(
        within(row).getByRole("button", { name: "Reactivate ana@example.com" }),
      ).toHaveFocus(),
    )
  })

  it("announces the pending text and disables every button while the change runs", async () => {
    render({
      [statusRoute(activeUser.id)]: () => new Promise<Response>(() => {}),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )

    await waitFor(() =>
      expect(status()).toHaveTextContent("Suspending account…"),
    )
    expect(
      screen.getByRole("button", { name: "Reactivate bob@example.com" }),
    ).toBeDisabled()
  })

  it("shows the error with Retry, which sends the same request again", async () => {
    let fail = true
    const { requests } = render({
      [statusRoute(activeUser.id)]: () =>
        fail
          ? jsonResponse(500, {})
          : jsonResponse(200, withStatus(activeUser, "Suspended")),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Error: Account could not be suspended. Try again.",
    )
    expect(within(await table()).getAllByRole("row")[1]).toHaveTextContent(
      "Active",
    )

    fail = false
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }))

    await waitFor(() =>
      expect(status()).toHaveTextContent("✓ Success: Account suspended."),
    )
    expect(requests.filter((request) => request.method === "PUT")).toHaveLength(
      2,
    )
  })

  it.each([
    [404, "Error: This account no longer exists."],
    [
      409,
      "Error: Administrator accounts cannot be suspended or reactivated here.",
    ],
  ])(
    "shows the message for %i and loads the list again",
    async (code, message) => {
      const { requests } = render({
        [statusRoute(activeUser.id)]: () => jsonResponse(code, {}),
      })
      await table()

      await userEvent.click(
        screen.getByRole("button", { name: "Suspend ana@example.com" }),
      )
      await userEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", {
          name: "Suspend",
        }),
      )

      expect(await screen.findByRole("alert")).toHaveTextContent(message)
      expect(
        within(screen.getByRole("alert")).queryByRole("button", {
          name: "Retry",
        }),
      ).toBeNull()
      await waitFor(() =>
        expect(
          requests.filter((request) => request.path === "/api/admin/accounts"),
        ).toHaveLength(2),
      )
    },
  )

  it("shows the Account Suspended page when the administrator was suspended meanwhile", async () => {
    let suspended = false
    render(
      {
        [statusRoute(activeUser.id)]: () => {
          suspended = true
          return jsonResponse(403, {})
        },
      },
      () => signedInUser("Administrator", suspended ? "Suspended" : "Active"),
    )
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Account suspended",
      }),
    ).toBeInTheDocument()
  })

  it("lists the suspended Registered User with Reactivate", async () => {
    render()

    expect(
      within(await table()).getByRole("button", {
        name: "Reactivate bob@example.com",
      }),
    ).toBeInTheDocument()
    expect(suspendedUser.accountStatus).toBe("Suspended")
  })
})

// Reactivating on the page (feature 014 spec User Story 2, FR-005, FR-006, FR-013).
describe("UserAccountsPage: reactivate", () => {
  it("reactivates without a dialog, announces it and moves focus to Suspend", async () => {
    const { requests } = render({
      [statusRoute(suspendedUser.id)]: () =>
        jsonResponse(200, withStatus(suspendedUser, "Active")),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Reactivate bob@example.com" }),
    )

    expect(screen.queryByRole("dialog")).toBeNull()
    await waitFor(() =>
      expect(status()).toHaveTextContent("✓ Success: Account reactivated."),
    )
    const puts = requests.filter((request) => request.method === "PUT")
    expect(puts).toHaveLength(1)
    expect(puts[0]?.body).toEqual({ accountStatus: "Active" })
    const row = within(await table()).getAllByRole("row")[2]!
    expect(row).toHaveTextContent("Active")
    await waitFor(() =>
      expect(
        within(row).getByRole("button", { name: "Suspend bob@example.com" }),
      ).toHaveFocus(),
    )
  })

  it("announces the reactivating text while the change runs", async () => {
    render({
      [statusRoute(suspendedUser.id)]: () => new Promise<Response>(() => {}),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Reactivate bob@example.com" }),
    )

    await waitFor(() =>
      expect(status()).toHaveTextContent("Reactivating account…"),
    )
    expect(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    ).toBeDisabled()
  })

  it("shows the reactivate error with Retry", async () => {
    render({
      [statusRoute(suspendedUser.id)]: () => jsonResponse(500, {}),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Reactivate bob@example.com" }),
    )

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(
      "Error: Account could not be reactivated. Try again.",
    )
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeEnabled()
    expect(within(await table()).getAllByRole("row")[2]).toHaveTextContent(
      "Suspended",
    )
  })
})

// Finding an account (feature 014 spec User Story 3, FR-001, FR-002, FR-012, FR-014).
describe("UserAccountsPage: search", () => {
  it("searches with Enter and lists only the answer", async () => {
    render({
      "GET /api/admin/accounts?search=ana": () =>
        jsonResponse(200, accountList([activeUser])),
    })
    await table()

    await userEvent.type(screen.getByLabelText("Search by email"), "ana{Enter}")

    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getAllByRole("row"),
      ).toHaveLength(2),
    )
    expect(screen.getByRole("table")).toHaveTextContent("ana@example.com")
  })

  it("shows no match with Clear search, which lists every account again", async () => {
    const { requests } = render({
      "GET /api/admin/accounts?search=nobody": () =>
        jsonResponse(200, accountList([])),
    })
    await table()

    await userEvent.type(screen.getByLabelText("Search by email"), "nobody")
    await userEvent.click(screen.getByRole("button", { name: "Search" }))

    expect(
      await screen.findByText("No accounts match your search."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("table")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }))

    expect(await table()).toBeInTheDocument()
    expect(screen.getByLabelText("Search by email")).toHaveValue("")
    expect(requests.at(-1)?.path).toBe("/api/admin/accounts")
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull()
  })

  it("explains the 50-account limit when more accounts match", async () => {
    render({
      [listRoute]: () => jsonResponse(200, accountList([activeUser], true)),
    })

    expect(
      await screen.findByText(
        "Showing the 50 most recently registered accounts. Search by email to find others.",
      ),
    ).toBeInTheDocument()
  })

  it("does not explain the limit when every account is shown", async () => {
    render()
    await table()

    expect(
      screen.queryByText(/Showing the 50 most recently registered accounts/),
    ).toBeNull()
  })

  it("shows the server's refusal next to the field and keeps the list", async () => {
    const tooLong = "a".repeat(257)
    render({
      [`GET /api/admin/accounts?search=${tooLong}`]: () =>
        jsonResponse(400, {
          errors: { search: ["Search text can be at most 256 characters."] },
        }),
    })
    await table()

    const field = screen.getByLabelText("Search by email")
    await userEvent.click(field)
    await userEvent.paste(tooLong)
    await userEvent.keyboard("{Enter}")

    const error = await screen.findByText(
      "Error: Search text can be at most 256 characters.",
    )
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveAttribute("aria-describedby", error.id)
    expect(await table()).toBeInTheDocument()
  })

  it("announces Loading accounts… during a search", async () => {
    render({
      "GET /api/admin/accounts?search=ana": () =>
        new Promise<Response>(() => {}),
    })
    await table()

    await userEvent.type(screen.getByLabelText("Search by email"), "ana{Enter}")

    await waitFor(() => expect(status()).toHaveTextContent("Loading accounts…"))
  })
})

// Fixes from the feature 014 code review.
describe("UserAccountsPage: code review fixes", () => {
  it("does not move focus to an account again when the list is shown after a later search", async () => {
    render({
      [statusRoute(suspendedUser.id)]: () =>
        jsonResponse(200, withStatus(suspendedUser, "Active")),
      "GET /api/admin/accounts?search=bob": () =>
        jsonResponse(200, accountList([withStatus(suspendedUser, "Active")])),
    })
    await table()
    await userEvent.click(
      screen.getByRole("button", { name: "Reactivate bob@example.com" }),
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Suspend bob@example.com" }),
      ).toHaveFocus(),
    )

    const field = screen.getByLabelText("Search by email")
    await userEvent.type(field, "bob{Enter}")
    await waitFor(() =>
      expect(
        within(screen.getByRole("table")).getAllByRole("row"),
      ).toHaveLength(2),
    )

    expect(field).toHaveFocus()
  })

  it("keeps the dialog open on Cancel and Escape while the suspension runs", async () => {
    let answer: (response: Response) => void = () => {}
    render({
      [statusRoute(activeUser.id)]: () =>
        new Promise<Response>((resolve) => (answer = resolve)),
    })
    await table()
    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    const dialog = screen.getByRole("dialog")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Suspend" }),
    )
    await waitFor(() =>
      expect(status()).toHaveTextContent("Suspending account…"),
    )

    await userEvent.keyboard("{Escape}")
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    )
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    answer(jsonResponse(200, withStatus(activeUser, "Suspended")))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(status()).toHaveTextContent("✓ Success: Account suspended.")
  })

  it("moves focus to the heading when the account is gone and the list loads again", async () => {
    render({
      [statusRoute(activeUser.id)]: () => jsonResponse(404, {}),
    })
    await table()

    await userEvent.click(
      screen.getByRole("button", { name: "Suspend ana@example.com" }),
    )
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Suspend",
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 1, name: "User accounts" }),
      ).toHaveFocus(),
    )
  })
})
