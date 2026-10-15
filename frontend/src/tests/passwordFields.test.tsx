import { screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { jsonResponse, renderApp, stubFetch } from "./renderApp"

// The password is never shown on screen (FR-009, SC-004).
describe("password fields", () => {
  it.each(["Password", "Confirm password"])(
    "masks %s as a new-password field",
    async (label) => {
      stubFetch(() => jsonResponse(401))
      renderApp("/register")

      const input = await screen.findByLabelText(label)
      expect(input).toHaveAttribute("type", "password")
      expect(input).toHaveAttribute("autocomplete", "new-password")
    },
  )
})
