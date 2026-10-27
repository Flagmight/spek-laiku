import { describe, expect, it } from "vitest"
import { loginDestination } from "../helpers/loginDestination"
import type { CurrentUser } from "../types/currentUser"

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

describe("loginDestination", () => {
  it.each([null, "/plans", "https://evil.example"])(
    "sends a Suspended user to the Account Suspended page whatever returnTo is (%s)",
    (returnTo) => {
      expect(loginDestination(suspendedUser, returnTo)).toBe(
        "/account-suspended",
      )
    },
  )

  it("returns an Active user to a safe returnTo", () => {
    expect(loginDestination(registeredUser, "/plans/3?tab=a")).toBe(
      "/plans/3?tab=a",
    )
    expect(loginDestination(administrator, "/plans")).toBe("/plans")
  })

  it.each([registeredUser, administrator])(
    "opens the home page for an Active $role without a safe returnTo",
    (user) => {
      expect(loginDestination(user, null)).toBe("/")
      expect(loginDestination(user, "//evil.example")).toBe("/")
    },
  )
})
