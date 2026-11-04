import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import { searchLocations } from "../api/locationsApi"
import type { PlanLocation } from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

describe("searchLocations", () => {
  it("sends the encoded text and returns the places", async () => {
    const { requests } = routeFetch({
      "GET /api/locations?query=%C5%A0iauliai%20%26%20Co": () =>
        jsonResponse(200, { locations: [kaunas] }),
    })

    const locations = await searchLocations("Šiauliai & Co")

    expect(locations).toEqual([kaunas])
    expect(requests).toHaveLength(1)
  })

  it.each([400, 403, 429, 500, 503])(
    "throws ApiError with status %i",
    async (status) => {
      routeFetch({
        "GET /api/locations?query=Kaunas": () => jsonResponse(status),
      })

      const error = await searchLocations("Kaunas").catch(
        (caught: unknown) => caught,
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(status)
    },
  )
})
