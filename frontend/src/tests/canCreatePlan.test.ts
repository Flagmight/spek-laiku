import { describe, expect, it } from "vitest"
import { canCreatePlan } from "../helpers/canCreatePlan"
import type { CurrentUserState } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"
import { signedInUser } from "./renderApp"

describe("canCreatePlan", () => {
  it.each<[CurrentUserState["status"], CurrentUser | null, boolean]>([
    ["loading", null, false],
    ["signedOut", null, true],
    // The signed-in state could not be read: treated as a visitor, as in the navigation.
    ["error", null, true],
    ["signedIn", signedInUser("Registered User", "Active"), true],
    ["signedIn", signedInUser("Registered User", "Suspended"), false],
    ["signedIn", signedInUser("Administrator", "Active"), false],
    ["signedIn", signedInUser("Administrator", "Suspended"), false],
  ])("is %s for status %s and user %j", (status, user, expected) => {
    expect(canCreatePlan(status, user)).toBe(expected)
  })
})
