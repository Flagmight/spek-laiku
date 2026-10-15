import { describe, expect, it } from "vitest"
import { formatErrorMessage } from "../helpers/formatErrorMessage"

describe("formatErrorMessage", () => {
  it("puts 'Error: ' in front of the message", () => {
    expect(formatErrorMessage("Enter a password.")).toBe(
      "Error: Enter a password.",
    )
  })
})
