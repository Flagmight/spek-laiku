import { describe, expect, it } from "vitest"
import { parseDecimal } from "../helpers/parseDecimal"

describe("parseDecimal", () => {
  it.each([
    ["0.5", 0.5],
    ["-30", -30],
    [" 12 ", 12],
    ["2", 2],
    ["1.25", 1.25],
  ])("reads %j as %d", (text, expected) => {
    expect(parseDecimal(text)).toBe(expected)
  })

  it("keeps a large number the server can still read", () => {
    expect(parseDecimal("78000000000000000000000000000")).toBe(7.8e28)
  })

  // The server's number type stops at about 7.9e28; past that the whole request would be refused
  // instead of the field getting its own message.
  it.each(["79000000000000000000000000000", "-" + "9".repeat(32)])(
    "returns null for %j, which the server cannot read",
    (text) => {
      expect(parseDecimal(text)).toBeNull()
    },
  )

  it.each(["", "   ", "2,5", "abc", "1e3", ".5", "5.", "+5", "1 000", "--1"])(
    "returns null for %j",
    (text) => {
      expect(parseDecimal(text)).toBeNull()
    },
  )
})
