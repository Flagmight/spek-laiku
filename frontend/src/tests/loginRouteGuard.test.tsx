import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

const signedInUser: CurrentUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

describe("/login for a signed-in user", () => {
  it("opens the home page without the Log in page flashing up", async () => {
    stubFetch(() => jsonResponse(200, signedInUser))
    renderApp("/login")

    // Nothing is shown while the signed-in state loads.
    expect(screen.queryByRole("heading", { name: "Log in" })).toBeNull()
    expect(screen.queryByLabelText("Email")).toBeNull()

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Log in" })).toBeNull()
  })
})

describe("login refused because the user is already signed in", () => {
  it("opens the home page with no error and refreshes the signed-in state", async () => {
    // Signed out when the page opened, signed in (another tab) by the time the form is sent.
    let signedIn = false
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/auth/login") {
        signedIn = true
        return Promise.resolve(
          jsonResponse(403, {
            title: "Already signed in.",
            status: 403,
            detail: "You are already signed in.",
          }),
        )
      }

      return Promise.resolve(
        signedIn ? jsonResponse(200, signedInUser) : jsonResponse(401),
      )
    })
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    renderApp("/login")
    await user.type(await screen.findByLabelText("Email"), signedInUser.email)
    await user.type(screen.getByLabelText("Password"), "Password123!")

    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Error:/)).toBeNull()
    expect(screen.queryByText(/Success:/)).toBeNull()
    expect(screen.queryByText(/already signed in/i)).toBeNull()
    expect(
      await screen.findByRole("button", { name: "Log out" }),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([path]) => path === "/api/auth/me").length,
    ).toBeGreaterThanOrEqual(2)
  })
})
