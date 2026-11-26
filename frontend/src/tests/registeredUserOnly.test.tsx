import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import {
  jsonResponse,
  renderAppWithLocation,
  routeFetch,
  signedInUser,
} from "./renderApp"

// My plans is only for signed-in, Active Registered Users (feature 010 spec FR-012, User Story 5).
describe("RegisteredUserOnly on My plans", () => {
  function render(user: CurrentUser | null) {
    routeFetch({
      "GET /api/auth/me": () =>
        user ? jsonResponse(200, user) : jsonResponse(401),
      "GET /api/plans": () => jsonResponse(200, []),
    })
    return renderAppWithLocation("/plans")
  }

  it("shows the page to an Active Registered User", async () => {
    render(signedInUser("Registered User", "Active"))

    expect(
      await screen.findByRole("heading", { level: 1, name: "My plans" }),
    ).toBeInTheDocument()
  })

  it("sends a Visitor to Log in and back here afterwards", async () => {
    const { currentLocation } = render(null)

    await waitFor(() =>
      expect(currentLocation()).toBe("/login?returnTo=%2Fplans"),
    )
    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()
  })

  it("shows Access denied to an Active Administrator, without the page", async () => {
    render(signedInUser("Administrator", "Active"))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "My plans" })).toBeNull()
  })

  // A Suspended account goes to its own page, whatever its role (project FR-041).
  it.each(["Registered User", "Administrator"])(
    "sends a Suspended %s to the Account suspended page",
    async (role) => {
      const { currentLocation } = render(signedInUser(role, "Suspended"))

      await waitFor(() => expect(currentLocation()).toBe("/account-suspended"))
    },
  )
})

// The same guard on a saved plan's address (feature 010 spec User Story 5).
describe("RegisteredUserOnly on a saved plan", () => {
  const planPath = "/plans/0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"

  function render(user: CurrentUser | null) {
    const routes = routeFetch({
      "GET /api/auth/me": () =>
        user ? jsonResponse(200, user) : jsonResponse(401),
    })
    return { ...routes, ...renderAppWithLocation(planPath) }
  }

  it("sends a Visitor to Log in with the plan as the return-to page", async () => {
    const { currentLocation } = render(null)

    await waitFor(() =>
      expect(currentLocation()).toBe(
        "/login?returnTo=" + encodeURIComponent(planPath),
      ),
    )
  })

  it("shows Access denied to an Active Administrator without asking for the plan", async () => {
    const { requests } = render(signedInUser("Administrator", "Active"))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
    // routeFetch would also fail the test for this unhandled request.
    expect(requests.map((request) => request.path)).not.toContain(
      "/api" + planPath,
    )
    expect(
      screen.queryByRole("link", { name: "Go to My plans" }),
    ).not.toBeInTheDocument()
  })

  it("sends a Suspended Registered User to the Account suspended page", async () => {
    const { currentLocation } = render(
      signedInUser("Registered User", "Suspended"),
    )

    await waitFor(() => expect(currentLocation()).toBe("/account-suspended"))
  })
})

// The Account page is for signed-in, Active Registered Users (feature 016 spec FR-011, User Story 2 scenarios 3 to
// 5). No deletion request is sent in any of these cases: routeFetch fails the test on any request without a handler.
describe("RegisteredUserOnly on the Account page", () => {
  function render(user: CurrentUser | null) {
    routeFetch({
      "GET /api/auth/me": () =>
        user ? jsonResponse(200, user) : jsonResponse(401),
      "GET /api/plans": () => jsonResponse(200, []),
    })
    return renderAppWithLocation("/account")
  }

  it("shows the page to an Active Registered User", async () => {
    render(signedInUser("Registered User", "Active"))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument()
  })

  it("sends a Visitor to Log in and back here afterwards", async () => {
    const { currentLocation } = render(null)

    await waitFor(() =>
      expect(currentLocation()).toBe("/login?returnTo=%2Faccount"),
    )
    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()
  })

  it("shows Access denied to an Active Administrator, without the page", async () => {
    render(signedInUser("Administrator", "Active"))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete account" })).toBeNull()
  })

  it.each(["Registered User", "Administrator"])(
    "sends a Suspended %s to the Account suspended page",
    async (role) => {
      const { currentLocation } = render(signedInUser(role, "Suspended"))

      await waitFor(() => expect(currentLocation()).toBe("/account-suspended"))
    },
  )
})

describe("Account page after logging in", () => {
  it("opens the Account page after a visitor logs in as an Active Registered User", async () => {
    const registeredUser = signedInUser("Registered User", "Active")
    let signedIn = false
    routeFetch({
      "GET /api/auth/me": () =>
        signedIn ? jsonResponse(200, registeredUser) : jsonResponse(401),
      "POST /api/auth/login": () => {
        signedIn = true
        return jsonResponse(200, registeredUser)
      },
      "GET /api/plans": () => jsonResponse(200, []),
    })
    const { currentLocation } = renderAppWithLocation("/account")
    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Email"), registeredUser.email)
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(
      await screen.findByRole("heading", { level: 1, name: "Account" }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe("/account")
  })
})
