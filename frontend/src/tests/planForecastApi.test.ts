import { describe, expect, it } from "vitest"
import { ApiError } from "../api/apiClient"
import { getPlanForecast } from "../api/planForecastApi"
import type { PlanForecastRequest } from "../types/planForecast"
import { planForecast } from "./forecastFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const forecastRoute = "POST /api/plan-forecast"

const request: PlanForecastRequest = {
  setup: { locationId: 593116, dates: ["2026-11-14"], maxTravelDistanceKm: 30 },
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

describe("getPlanForecast", () => {
  it("posts the request and returns the forecast on 200", async () => {
    const forecast = planForecast(["2026-11-14"], 1)
    const { requests } = routeFetch({
      [forecastRoute]: () => jsonResponse(200, forecast),
    })

    const outcome = await getPlanForecast(request)

    expect(outcome).toEqual({ kind: "forecast", forecast })
    expect(requests).toEqual([
      { method: "POST", path: "/api/plan-forecast", body: request },
    ])
  })

  it.each([500, 502])("throws ApiError for %i", async (status) => {
    routeFetch({ [forecastRoute]: () => jsonResponse(status) })

    await expect(getPlanForecast(request)).rejects.toEqual(new ApiError(status))
  })
})

describe("getPlanForecast failures", () => {
  it("maps a 503 for the weather service to weatherUnavailable", async () => {
    routeFetch({
      [forecastRoute]: () =>
        jsonResponse(503, {
          status: 503,
          title: "Service unavailable.",
          detail: "The weather service is unavailable. No forecast is shown.",
          service: "forecast",
        }),
    })

    expect(await getPlanForecast(request)).toEqual({
      kind: "weatherUnavailable",
    })
  })

  it("maps a 429 to tooManyRequests", async () => {
    routeFetch({ [forecastRoute]: () => jsonResponse(429, { status: 429 }) })

    expect(await getPlanForecast(request)).toEqual({ kind: "tooManyRequests" })
  })

  it.each([
    ["a 503 from the location search", { service: "locationSearch" }],
    ["a 503 without a service", { status: 503 }],
    ["a 503 without a body", undefined],
  ])("throws ApiError for %s", async (_case, body) => {
    routeFetch({ [forecastRoute]: () => jsonResponse(503, body) })

    await expect(getPlanForecast(request)).rejects.toEqual(new ApiError(503))
  })
})
