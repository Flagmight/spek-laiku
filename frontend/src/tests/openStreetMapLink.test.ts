import { describe, expect, it } from "vitest"
import { openStreetMapLink } from "../helpers/openStreetMapLink"

describe("openStreetMapLink", () => {
  it("opens OpenStreetMap with a marker at the place and the map centred on it", () => {
    expect(openStreetMapLink(54.8972, 23.8861)).toBe(
      "https://www.openstreetmap.org/?mlat=54.8972&mlon=23.8861#map=17/54.8972/23.8861",
    )
  })

  it("writes the numbers as the server gave them", () => {
    expect(openStreetMapLink(54.91234, 23.9)).toBe(
      "https://www.openstreetmap.org/?mlat=54.91234&mlon=23.9#map=17/54.91234/23.9",
    )
  })
})
