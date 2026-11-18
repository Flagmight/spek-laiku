import { describe, expect, it } from "vitest"
import { canViewSavedPlans } from "../helpers/canViewSavedPlans"
import type { CurrentUserState } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"
import { signedInUser } from "./renderApp"

describe("canViewSavedPlans", () => {
  it.each<[CurrentUserState["status"], CurrentUser | null, boolean]>([
    ["loading", null, false],
    ["signedOut", null, false],
    ["error", null, false],
    ["signedIn", signedInUser("Registered User", "Active"), true],
    ["signedIn", signedInUser("Registered User", "Suspended"), false],
    ["signedIn", signedInUser("Administrator", "Active"), false],
    ["signedIn", signedInUser("Administrator", "Suspended"), false],
  ])("is %s for status %s and user %j", (status, user, expected) => {
    expect(canViewSavedPlans(status, user)).toBe(expected)
  })
})
