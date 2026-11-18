import { screen, waitFor } from "@testing-library/react"
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
