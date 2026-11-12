import { describe, expect, it } from "vitest"
import { placeDistanceText } from "../helpers/placeText"

describe("placeDistanceText", () => {
  it("words the distance with one decimal place", () => {
    expect(placeDistanceText(3.4)).toBe("3.4 km away")
  })

  it("keeps the decimal place for a whole number", () => {
    expect(placeDistanceText(3)).toBe("3.0 km away")
  })

  it("words a place at the plan's location and one at the 50 km cap", () => {
    expect(placeDistanceText(0)).toBe("0.0 km away")
    expect(placeDistanceText(50)).toBe("50.0 km away")
  })
})
