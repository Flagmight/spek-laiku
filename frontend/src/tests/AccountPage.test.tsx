import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CurrentUser } from "../types/currentUser"
import type { RecordedRequest } from "./renderApp"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

type Handler = (request: RecordedRequest) => Response | Promise<Response>

const deleteRoute = "POST /api/account/delete"
const password = "Password123!"
const question =
  "Delete your account user@example.com? All your saved plans will be deleted. This cannot be undone."

// Signed in as an Active Registered User on the Account page. After a deletion /api/auth/me answers 401, as the
// server does once the cookie is removed.
function render(handlers: Record<string, Handler> = {}, me?: () => Response) {
  let deleted = false
  const routes = routeFetch({
    "GET /api/auth/me": () =>
      me ? me() : deleted ? jsonResponse(401) : jsonResponse(200, user()),
    "GET /api/plans": () => jsonResponse(200, []),
    [deleteRoute]: () => {
      deleted = true
      return jsonResponse(204)
    },
    ...handlers,
  })
  const location = renderAppWithLocation("/account")
  return { ...routes, ...location }
}

function user(accountStatus: CurrentUser["accountStatus"] = "Active") {
  return signedInUser("Registered User", accountStatus)
}

async function openDialog() {
  const events = userEvent.setup()
  await events.click(
    await screen.findByRole("button", { name: "Delete account" }),
  )
  return { events, dialog: screen.getByRole("dialog", { name: question }) }
}

function passwordField() {
  return screen.getByLabelText("Password")
}

function confirmButton(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "Delete account" })
}

// The Account page (feature 016 spec User Story 1, FR-001, FR-002, FR-004, FR-007, FR-008, FR-013, FR-016).
describe("AccountPage", () => {
  it("shows the heading, the tab title, the email and the warning", async () => {
    render()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("Account - Spėk laiku")
    expect(screen.getByText("user@example.com")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Deleting your account also deletes all your saved plans. This cannot be undone.",
      ),
    ).toBeInTheDocument()
  })

  it("opens the dialog with the email in the question and focus in the field", async () => {
    render()

    const { dialog } = await openDialog()

    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(passwordField()).toHaveFocus()
    expect(passwordField()).toHaveAttribute("type", "password")
    expect(passwordField()).toHaveAttribute("autocomplete", "current-password")
  })

  it.each(["Cancel", "Escape"])(
    "closes on %s without a request, returns focus and empties the field",
    async (how) => {
      const { requests } = render()
      const { events, dialog } = await openDialog()
      await events.type(passwordField(), password)

      if (how === "Cancel") {
        await events.click(
          within(dialog).getByRole("button", { name: "Cancel" }),
        )
      } else {
        await events.keyboard("{Escape}")
      }

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: "Delete account" }),
      ).toHaveFocus()
      expect(requests.some((request) => request.method === "POST")).toBe(false)
      await openDialog()
      expect(passwordField()).toHaveValue("")
    },
  )

  it("asks for the password when the field is empty, without a request", async () => {
    const { requests } = render()
    const { events, dialog } = await openDialog()

    await events.click(confirmButton(dialog))

    const error = screen.getByText("Error: Enter your password.")
    expect(passwordField()).toHaveAttribute("aria-invalid", "true")
    expect(passwordField().getAttribute("aria-describedby")).toContain(error.id)
    expect(passwordField()).toHaveFocus()
    expect(requests.some((request) => request.method === "POST")).toBe(false)
  })

  it("empties and focuses the field after a wrong password and keeps the dialog open", async () => {
    render({
      [deleteRoute]: () =>
        jsonResponse(400, { errors: { password: ["Password is incorrect."] } }),
    })
    const { events, dialog } = await openDialog()
    await events.type(passwordField(), "wrong")

    await events.click(confirmButton(dialog))

    expect(
      await screen.findByText("Error: Password is incorrect."),
    ).toBeInTheDocument()
    expect(passwordField()).toHaveValue("")
    expect(passwordField()).toHaveFocus()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("shows the lock message without Retry and stays on the Account page", async () => {
    const { currentLocation } = render({
      [deleteRoute]: () => jsonResponse(429, {}),
    })
    const { events, dialog } = await openDialog()
    await events.type(passwordField(), password)

    await events.click(confirmButton(dialog))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Error: Too many incorrect passwords. Try again in 15 minutes.",
    )
    expect(
      within(dialog).queryByRole("button", { name: "Retry" }),
    ).not.toBeInTheDocument()
    expect(passwordField()).toHaveValue("")
    expect(currentLocation()).toBe("/account")
  })

  it("shows the pending text with the field and buttons disabled", async () => {
    render({ [deleteRoute]: () => new Promise<Response>(() => {}) })
    const { events, dialog } = await openDialog()
    await events.type(passwordField(), password)

    await events.click(confirmButton(dialog))

    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Deleting your account…",
    )
    expect(passwordField()).toBeDisabled()
    expect(confirmButton(dialog)).toBeDisabled()
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toBeDisabled()
  })

  it("offers Retry after a server error and Retry sends the same password", async () => {
    let calls = 0
    let deleted = false
    const { requests, currentLocation } = render(
      {
        [deleteRoute]: () => {
          calls++
          if (calls === 1) {
            return jsonResponse(500, {})
          }

          deleted = true
          return jsonResponse(204)
        },
      },
      () => (deleted ? jsonResponse(401) : jsonResponse(200, user())),
    )
    const { events, dialog } = await openDialog()
    await events.type(passwordField(), password)
    await events.click(confirmButton(dialog))
    const retry = await within(dialog).findByRole("button", { name: "Retry" })
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Error: Account could not be deleted. Try again.",
    )
    expect(retry).toHaveFocus()

    await events.click(retry)

    await waitFor(() => expect(currentLocation()).toBe("/"))
    const deletions = requests.filter((request) => request.method === "POST")
    expect(deletions.map((request) => request.body)).toEqual([
      { password },
      { password },
    ])
  })

  it("lands on Home as a visitor with the success message and clears the plan in progress", async () => {
    const { currentLocation } = render()
    usePlanSetupStore.getState().setLocationText("Kaunas")
    const { events, dialog } = await openDialog()
    await events.type(passwordField(), password)

    await events.click(confirmButton(dialog))

    await waitFor(() => expect(currentLocation()).toBe("/"))
    expect(
      await screen.findByText("✓ Success: Your account has been deleted."),
    ).toBeInTheDocument()
    const navigation = screen.getByRole("navigation", { name: "Main" })
    expect(
      await within(navigation).findByRole("link", { name: "Log in" }),
    ).toBeInTheDocument()
    expect(
      within(navigation).queryByRole("link", { name: "Account" }),
    ).not.toBeInTheDocument()
    expect(usePlanSetupStore.getState().locationText).toBe("")
  })

  it("submits with Enter in the field", async () => {
    const { currentLocation } = render()
    const { events } = await openDialog()

    await events.type(passwordField(), `${password}{Enter}`)

    await waitFor(() => expect(currentLocation()).toBe("/"))
  })
})
