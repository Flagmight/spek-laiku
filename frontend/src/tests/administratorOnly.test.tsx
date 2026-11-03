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

const page = "/admin/categories"

function categoryRequests(requests: { path: string }[]) {
  return requests.filter((request) =>
    request.path.startsWith("/api/admin/categories"),
  )
}

function stubSignedIn(user: CurrentUser) {
  return routeFetch({
    "GET /api/auth/me": () => jsonResponse(200, user),
    "GET /api/admin/categories": () => jsonResponse(200, []),
  })
}

describe("/admin/categories access", () => {
  it("sends a visitor to log in, then opens the page after an administrator logs in", async () => {
    const administrator = signedInUser("Administrator")
    let signedIn = false
    routeFetch({
      "GET /api/auth/me": () =>
        signedIn ? jsonResponse(200, administrator) : jsonResponse(401),
      "POST /api/auth/login": () => {
        signedIn = true
        return jsonResponse(200, administrator)
      },
      "GET /api/admin/categories": () => jsonResponse(200, []),
    })
    const { currentLocation } = renderAppWithLocation(page)

    expect(await screen.findByText("Log in to continue.")).toBeInTheDocument()
    expect(currentLocation()).toBe("/login?returnTo=%2Fadmin%2Fcategories")

    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Email"), administrator.email)
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log in" }))

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity categories",
      }),
    ).toBeInTheDocument()
    expect(currentLocation()).toBe(page)
  })

  it("shows Access denied to an Active Registered User at the same address", async () => {
    const { requests } = stubSignedIn(signedInUser("Registered User"))
    const { currentLocation } = renderAppWithLocation(page)

    expect(
      await screen.findByRole("heading", { level: 1, name: "Access denied" }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(document.title).toBe("Access denied - Spėk laiku"),
    )
    expect(
      screen.getByText("You do not have permission to open this page."),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Go to the home page" }),
    ).toHaveAttribute("href", "/")
    expect(currentLocation()).toBe(page)
    expect(
      screen.queryByRole("heading", { name: "Activity categories" }),
    ).not.toBeInTheDocument()
    expect(categoryRequests(requests)).toHaveLength(0)
  })

  it.each([
    ["Registered User", "Suspended"],
    ["Administrator", "Suspended"],
  ] as const)(
    "sends a %s with status %s to the Account suspended page",
    async (role, status) => {
      const { requests } = stubSignedIn(signedInUser(role, status))
      const { currentLocation } = renderAppWithLocation(page)

      expect(
        await screen.findByRole("heading", {
          level: 1,
          name: "Account suspended",
        }),
      ).toBeInTheDocument()
      expect(currentLocation()).toBe("/account-suspended")
      expect(categoryRequests(requests)).toHaveLength(0)
    },
  )

  it("shows the page to an Active Administrator", async () => {
    stubSignedIn(signedInUser("Administrator"))
    renderAppWithLocation(page)

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Activity categories",
      }),
    ).toBeInTheDocument()
  })
})
