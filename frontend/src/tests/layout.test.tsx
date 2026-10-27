import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

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
