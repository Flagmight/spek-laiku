import { describe, expect, it, vi } from "vitest"
import { ApiError } from "../api/apiClient"
import { getPlanSchedule } from "../api/planScheduleApi"
import type { PlanScheduleRequest } from "../types/planSchedule"
import { jsonResponse, routeFetch } from "./renderApp"

const scheduleRoute = "POST /api/plan-schedule"

const request: PlanScheduleRequest = {
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

const schedule = {
  scheduled: [
    {
      activityName: "Kayaking",
      date: "2026-11-14",
      startTime: "10:00",
      endTime: "12:00",
      place: {
        name: "Slipway",
        latitude: 54.89,
        longitude: 23.93,
        distanceKm: 3.4,
        area: "Kaunas",
      },
      weather: {
        temperatureC: 18.5,
        rainMmPerHour: 0.2,
        windMs: 3.1,
        isIndoor: false,
      },
      travel: null,
    },
  ],
  unscheduled: [],
  travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
}

describe("getPlanSchedule", () => {
  it("posts the request and returns the schedule on 200", async () => {
    const { requests } = routeFetch({
      [scheduleRoute]: () => jsonResponse(200, schedule),
    })

    const answer = await getPlanSchedule(request)

    expect(answer).toEqual({ kind: "schedule", schedule })
    expect(requests).toEqual([
      { method: "POST", path: "/api/plan-schedule", body: request },
    ])
  })

  it.each([500, 502])("throws ApiError for %i", async (status) => {
    routeFetch({ [scheduleRoute]: () => jsonResponse(status) })

    await expect(getPlanSchedule(request)).rejects.toEqual(new ApiError(status))
  })

  it("passes a network error through", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    await expect(getPlanSchedule(request)).rejects.toBeInstanceOf(TypeError)
  })
})

describe("getPlanSchedule service failures", () => {
  it("maps a 503 for the weather service to weatherUnavailable", async () => {
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(503, {
          status: 503,
          title: "Service unavailable.",
          detail: "The weather service is unavailable.",
          service: "forecast",
        }),
    })

    expect(await getPlanSchedule(request)).toEqual({
      kind: "weatherUnavailable",
    })
  })

  it("maps a 503 for the places service to placesUnavailable", async () => {
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(503, {
          status: 503,
          title: "Service unavailable.",
          detail: "The map data service is unavailable.",
          service: "places",
        }),
    })

    expect(await getPlanSchedule(request)).toEqual({
      kind: "placesUnavailable",
    })
  })

  it("maps 429 to tooManyRequests", async () => {
    routeFetch({ [scheduleRoute]: () => jsonResponse(429, { status: 429 }) })

    expect(await getPlanSchedule(request)).toEqual({ kind: "tooManyRequests" })
  })

  it.each([
    [
      "a 503 from another service",
      () => jsonResponse(503, { service: "locationSearch" }),
    ],
    [
      "a 503 without a readable body",
      () => new Response("oops", { status: 503 }),
    ],
    ["a 500", () => jsonResponse(500)],
  ])("throws ApiError for %s", async (_case, answer) => {
    routeFetch({ [scheduleRoute]: answer })

    await expect(getPlanSchedule(request)).rejects.toBeInstanceOf(ApiError)
  })
})

describe("getPlanSchedule access", () => {
  it("maps 403 to forbidden", async () => {
    routeFetch({ [scheduleRoute]: () => jsonResponse(403) })

    expect(await getPlanSchedule(request)).toEqual({ kind: "forbidden" })
  })
})

describe("getPlanSchedule when the plan is out of date", () => {
  it("maps a 400 with a setup key to setupOutdated", async () => {
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(400, {
          errors: { "setup.dates[0]": ["Dates cannot be in the past."] },
        }),
    })

    expect(await getPlanSchedule(request)).toEqual({ kind: "setupOutdated" })
  })

  it("maps a 400 with only activity keys to activitiesOutdated", async () => {
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(400, {
          errors: {
            "activities[0].maxWindMs": [
              "Enter a wind limit between 0 and 30 m/s.",
            ],
          },
        }),
    })

    expect(await getPlanSchedule(request)).toEqual({
      kind: "activitiesOutdated",
    })
  })

  it.each([
    [
      "only request",
      () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    ],
    ["an unreadable body", () => new Response("oops", { status: 400 })],
  ])("throws ApiError for a 400 with %s", async (_case, answer) => {
    routeFetch({ [scheduleRoute]: answer })

    await expect(getPlanSchedule(request)).rejects.toEqual(new ApiError(400))
  })
})
