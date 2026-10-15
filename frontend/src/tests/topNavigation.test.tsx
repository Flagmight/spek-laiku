import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

const signedInUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

function navigation() {
  return within(screen.getByRole("navigation", { name: "Main" }))
}

describe("top navigation", () => {
  it("shows Home and Register to a visitor", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/")

    expect(
      await navigation().findByRole("link", { name: "Register" }),
    ).toHaveAttribute("href", "/register")
    expect(navigation().getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    )
    expect(navigation().queryByRole("link", { name: /log in/i })).toBeNull()
  })

  it("shows only Home to a signed-in user", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, signedInUser))
    renderApp("/")

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
    await screen.findByRole("heading", { level: 1 })

    expect(navigation().getAllByRole("link")).toHaveLength(1)
    expect(navigation().getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("does not show Register while the signed-in state is loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    )
    renderApp("/")

    expect(navigation().queryByRole("link", { name: "Register" })).toBeNull()
  })

  it("marks the current page", async () => {
    stubFetch(() => jsonResponse(401))
    renderApp("/register")

    expect(
      await navigation().findByRole("link", { name: "Register" }),
    ).toHaveAttribute("aria-current", "page")
    expect(
      navigation().getByRole("link", { name: "Home" }),
    ).not.toHaveAttribute("aria-current")
  })

  it("hides Register after a successful registration", async () => {
    let signedIn = false
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) => {
        if (path === "/api/registration") {
          signedIn = true
          return Promise.resolve(jsonResponse(201, {}))
        }

        return Promise.resolve(
          signedIn ? jsonResponse(200, signedInUser) : jsonResponse(401),
        )
      }),
    )
    const user = userEvent.setup()
    renderApp("/register")
    await user.type(await screen.findByLabelText("Email"), "user@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.type(screen.getByLabelText("Confirm password"), "Password123!")
    expect(navigation().getByRole("link", { name: "Register" })).toBeVisible()

    await user.click(screen.getByRole("button", { name: "Create account" }))

    await screen.findByText("✓ Success: Account created.")
    await vi.waitFor(() =>
      expect(navigation().queryByRole("link", { name: "Register" })).toBeNull(),
    )
  })
})
