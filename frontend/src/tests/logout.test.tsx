import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, renderApp } from "./renderApp"

const registeredUser: CurrentUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

const administrator: CurrentUser = { ...registeredUser, role: "Administrator" }

const suspendedUser: CurrentUser = {
  ...registeredUser,
  accountStatus: "Suspended",
}

const serverErrorMessage = "Error: Something went wrong. Try again."

function navigation() {
  return within(screen.getByRole("navigation", { name: "Main" }))
}

// The user is signed in until a logout request gets a 204.
function stubApi(user: CurrentUser, respondToLogout: () => Response) {
  let signedIn = true
  const fetchMock = vi.fn((path: string) => {
    if (path === "/api/auth/logout") {
      const response = respondToLogout()
      if (response.status === 204) {
        signedIn = false
      }
      return Promise.resolve(response)
    }

    return Promise.resolve(
      signedIn ? jsonResponse(200, user) : jsonResponse(401),
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

function noContent() {
  return new Response(null, { status: 204 })
}

describe("Log out", () => {
  it.each([
    ["Registered User", registeredUser],
    ["Administrator", administrator],
    ["Suspended user", suspendedUser],
  ])(
    "is shown to a signed-in %s instead of Log in and Register",
    async (_, user) => {
      stubApi(user, noContent)
      renderApp("/")

      expect(
        await navigation().findByRole("button", { name: "Log out" }),
      ).toBeInTheDocument()
      expect(navigation().queryByRole("link", { name: "Log in" })).toBeNull()
      expect(navigation().queryByRole("link", { name: "Register" })).toBeNull()
    },
  )

  it("leaves a Suspended user only Home and Log out", async () => {
    stubApi(suspendedUser, noContent)
    renderApp("/account-suspended")

    await screen.findByRole("heading", { level: 1, name: "Account suspended" })

    expect(
      navigation()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home"])
    expect(
      navigation()
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Log out"])
  })

  it("opens the home page with the success banner and the visitor navigation", async () => {
    stubApi(registeredUser, noContent)
    const user = userEvent.setup()
    renderApp("/")

    await user.click(
      await navigation().findByRole("button", { name: "Log out" }),
    )

    expect(
      await screen.findByText("✓ Success: You have logged out."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(
      navigation()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Home", "Log in", "Register"])
    expect(navigation().queryByRole("button", { name: "Log out" })).toBeNull()
  })

  it("shows the error with Retry under the navigation on failure and keeps the user signed in", async () => {
    let respond = () => jsonResponse(500)
    stubApi(registeredUser, () => respond())
    const user = userEvent.setup()
    renderApp("/")

    await user.click(
      await navigation().findByRole("button", { name: "Log out" }),
    )

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(serverErrorMessage)
    // Under the navigation: the alert comes after the header in the page.
    expect(
      screen.getByRole("banner").compareDocumentPosition(alert) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      navigation().getByRole("button", { name: "Log out" }),
    ).toBeInTheDocument()

    respond = noContent
    await user.click(within(alert).getByRole("button", { name: "Retry" }))

    expect(
      await screen.findByText("✓ Success: You have logged out."),
    ).toBeInTheDocument()
    expect(screen.queryByText(serverErrorMessage)).toBeNull()
  })
})
