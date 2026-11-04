import { describe, expect, it } from "vitest"
import { parseTravelDistance } from "../helpers/parseTravelDistance"

describe("parseTravelDistance", () => {
  it.each(["", "   "])("leaves %j to the default", (text) => {
    expect(parseTravelDistance(text)).toEqual({ kind: "default" })
  })

  it.each(["45", " 45 ", "045"])("reads %j as 45", (text) => {
    expect(parseTravelDistance(text)).toEqual({ kind: "number", value: 45 })
  })

  it("sends a decimal as it is, so the server refuses it with its message", () => {
    expect(parseTravelDistance("12.5")).toEqual({ kind: "number", value: 12.5 })
  })

  it.each(["abc", "1e3", "12,5", "-", "-5", "4 5"])(
    "refuses %j, which cannot be sent as a number",
    (text) => {
      expect(parseTravelDistance(text)).toEqual({ kind: "invalid" })
    },
  )
})
