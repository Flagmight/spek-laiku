import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../api/apiClient"
import { getPlanPlaces } from "../api/planPlacesApi"
import type { PlanPlacesRequest } from "../types/planPlaces"
import { planPlaces } from "./placesFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const placesRoute = "POST /api/plan-places"

const request: PlanPlacesRequest = {
  setup: { locationId: 598316, dates: ["2026-11-14"], maxTravelDistanceKm: 30 },
  activities: [
    {
      categoryId: "category-kayaking",
      type: "Outdoor",
      durationHours: 2,
      requiresDaylight: true,
      maxWindMs: 8,
      maxRainMmPerHour: 0.5,
      minTemperatureC: 15,
      maxTemperatureC: 35,
    },
  ],
}

describe("getPlanPlaces", () => {
  it("posts the request and returns the places on 200", async () => {
    const places = planPlaces(["category-kayaking"])
    const { requests } = routeFetch({
      [placesRoute]: () => jsonResponse(200, places),
    })

    const outcome = await getPlanPlaces(request)

    expect(outcome).toEqual({ kind: "places", places })
    expect(requests).toEqual([
      { method: "POST", path: "/api/plan-places", body: request },
    ])
  })

  it.each([500, 502])("throws ApiError for %i", async (status) => {
    routeFetch({ [placesRoute]: () => jsonResponse(status) })

    await expect(getPlanPlaces(request)).rejects.toEqual(new ApiError(status))
  })

  it("passes a network error through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    await expect(getPlanPlaces(request)).rejects.toBeInstanceOf(TypeError)
  })
})
