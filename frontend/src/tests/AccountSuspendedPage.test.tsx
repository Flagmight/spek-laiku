import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

const activeUser: CurrentUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

const suspendedUser: CurrentUser = {
  ...activeUser,
  accountStatus: "Suspended",
}

describe("AccountSuspendedPage", () => {
  it("shows a signed-in Suspended user the heading, title and explanation", async () => {
    stubFetch(() => jsonResponse(200, suspendedUser))
    renderApp("/account-suspended")

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Account suspended",
      }),
    ).toBeInTheDocument()
    expect(document.title).toBe("Account suspended - Spėk laiku")
    expect(
      screen.getByText(
        "Your account is suspended. Features that need an active account are blocked until an administrator reactivates it.",
      ),
    ).toBeInTheDocument()
  })

  it.each([
    ["a visitor", () => jsonResponse(401)],
    ["an Active user", () => jsonResponse(200, activeUser)],
  ])("sends %s to the home page", async (_, response) => {
    stubFetch(response)
    renderApp("/account-suspended")

    expect(
      await screen.findByRole("heading", { level: 1, name: "Spėk laiku" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { name: "Account suspended" }),
    ).not.toBeInTheDocument()
  })
})
