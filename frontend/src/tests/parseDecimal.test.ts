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

  it.each(["", "   ", "2,5", "abc", "1e3", ".5", "5.", "+5", "1 000", "--1"])(
    "returns null for %j",
    (text) => {
      expect(parseDecimal(text)).toBeNull()
    },
  )
})
