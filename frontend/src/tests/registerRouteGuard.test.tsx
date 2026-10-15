import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

const signedInUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

describe("/register for a signed-in user", () => {
  it("opens the home page instead of the registration form", async () => {
    stubFetch(() => jsonResponse(200, signedInUser))
    renderApp("/register")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Register" }),
    ).not.toBeInTheDocument()
  })

  it("shows no form while the signed-in state is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderApp("/register")

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument()
  })

  it("shows the form to a visitor", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    expect(await screen.findByLabelText("Email")).toBeInTheDocument()
  })

  it("shows the form when the signed-in state cannot be read", async () => {
    stubFetch(() => jsonResponse(500))
    renderApp("/register")

    expect(await screen.findByLabelText("Email")).toBeInTheDocument()
  })
})

describe("registration refused because the user is already signed in", () => {
  it("opens the home page with no error and no banner, and refreshes the signed-in state", async () => {
    // Signed out when the page opened, signed in (another tab) by the time the form is sent.
    let signedIn = false
    const fetchMock = vi.fn((path: string) => {
      if (path === "/api/registration") {
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
    renderApp("/register")
    await user.type(await screen.findByLabelText("Email"), "new@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")

    await user.click(screen.getByRole("button", { name: "Create account" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Error:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Success:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/already signed in/i)).not.toBeInTheDocument()
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("link", { name: "Register" }),
      ).not.toBeInTheDocument(),
    )
    expect(
      fetchMock.mock.calls.filter(([path]) => path === "/api/auth/me").length,
    ).toBeGreaterThanOrEqual(2)
  })
})
