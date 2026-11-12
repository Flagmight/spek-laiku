import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import {
  planForecastTimeoutMs,
  usePlanForecastStore,
} from "../stores/usePlanForecastStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import { planForecast } from "./forecastFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const forecastRoute = "POST /api/plan-forecast"

const setup: CheckedPlanSetup = {
  location: {
    id: 593116,
    name: "Vilnius",
    area: "Vilnius County",
    latitude: 54.6872,
    longitude: 25.2797,
  },
  dates: ["2026-11-14"],
  maxTravelDistanceKm: 30,
}

const activities: CheckedPlanActivity[] = [
  {
    id: "browser-id-1",
    categoryId: "category-kayaking",
    name: "Kayaking",
    type: "Outdoor",
    durationHours: 2,
    requiresDaylight: true,
    maxWindMs: 8,
    maxRainMmPerHour: 0.5,
    minTemperatureC: 15,
    maxTemperatureC: 35,
  },
]

function store() {
  return usePlanForecastStore.getState()
}

// Every request waits until the test answers it, and rejects when it is aborted.
function stubPendingRequests() {
  const pending: {
    signal: AbortSignal
    resolve: (response: Response) => void
  }[] = []
  const fetchMock = vi.fn(
    (_path: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init!.signal!
        pending.push({ signal, resolve })
        signal.addEventListener("abort", () =>
          reject(new DOMException("The request was aborted.", "AbortError")),
        )
      }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, pending }
}

describe("usePlanForecastStore", () => {
  it("is loading while the request runs, then keeps the forecast", async () => {
    const forecast = planForecast(["2026-11-14"], 1)
    const { pending } = stubPendingRequests()

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    expect(store().status).toBe("loading")
    expect(store().forecast).toBeNull()

    await act(async () => {
      pending[0].resolve(jsonResponse(200, forecast))
      await load
    })

    expect(store().status).toBe("loaded")
    expect(store().forecast).toEqual(forecast)
    expect(store().lastSetup).toBe(setup)
    expect(store().lastActivities).toBe(activities)
  })

  it("sends the request built from the checked setup and activities", async () => {
    const { requests } = routeFetch({
      [forecastRoute]: () => jsonResponse(200, planForecast(["2026-11-14"], 1)),
    })

    await act(() => store().load(setup, activities))

    expect(requests[0].body).toEqual({
      setup: {
        locationId: 593116,
        dates: ["2026-11-14"],
        maxTravelDistanceKm: 30,
      },
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
    })
  })

  it("sends only one request when asked twice while loading", async () => {
    const { fetchMock, pending } = stubPendingRequests()

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = store().load(setup, activities)
      void store().load(setup, activities)
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planForecast(["2026-11-14"], 1)))
      await first
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("reports a server error and keeps no forecast for a 500", async () => {
    routeFetch({ [forecastRoute]: () => jsonResponse(500) })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("serverError")
    expect(store().forecast).toBeNull()
  })

  it("aborts on reset and drops the late answer", async () => {
    const { pending } = stubPendingRequests()

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    act(() => store().reset())
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planForecast(["2026-11-14"], 1)))
      await load
    })

    expect(pending[0].signal.aborted).toBe(true)
    expect(store().status).toBe("idle")
    expect(store().forecast).toBeNull()
  })
})

describe("usePlanForecastStore failures", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    [
      "weatherUnavailable",
      () => jsonResponse(503, { status: 503, service: "forecast" }),
    ],
    ["tooManyRequests", () => jsonResponse(429, { status: 429 })],
    ["serverError", () => jsonResponse(500)],
    [
      "serverError",
      () => jsonResponse(503, { status: 503, service: "locationSearch" }),
    ],
  ] as const)("sets %s and keeps no forecast", async (status, answer) => {
    routeFetch({ [forecastRoute]: answer })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe(status)
    expect(store().forecast).toBeNull()
  })

  it("reports a server error for a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("serverError")
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { pending } = stubPendingRequests()

    act(() => {
      void store().load(setup, activities)
    })
    await act(() => vi.advanceTimersByTimeAsync(planForecastTimeoutMs - 1))
    expect(store().status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(planForecastTimeoutMs).toBe(10_000)
    expect(store().status).toBe("serverError")
    expect(pending[0].signal.aborted).toBe(true)
  })

  it("clears an earlier forecast when a later request fails", async () => {
    let answer = jsonResponse(200, planForecast(["2026-11-14"], 1))
    routeFetch({ [forecastRoute]: () => answer })
    await act(() => store().load(setup, activities))
    expect(store().forecast).not.toBeNull()

    answer = jsonResponse(503, { status: 503, service: "forecast" })
    await act(() => store().retry())

    expect(store().status).toBe("weatherUnavailable")
    expect(store().forecast).toBeNull()
  })

  it("sends the same request on Retry", async () => {
    let answer = jsonResponse(500)
    const { requests } = routeFetch({ [forecastRoute]: () => answer })
    await act(() => store().load(setup, activities))

    answer = jsonResponse(200, planForecast(["2026-11-14"], 1))
    await act(() => store().retry())

    expect(requests).toHaveLength(2)
    expect(requests[1].body).toEqual(requests[0].body)
    expect(store().status).toBe("loaded")
  })

  it("is retrying, not loading, while Retry runs, and runs only one request at a time", async () => {
    const { fetchMock, pending } = stubPendingRequests()
    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(500))
      await load
    })

    let retry: Promise<void> = Promise.resolve()
    act(() => {
      retry = store().retry()
      void store().load(setup, activities)
      void store().retry()
    })
    expect(store().status).toBe("retrying")

    await act(async () => {
      pending[1].resolve(jsonResponse(200, planForecast(["2026-11-14"], 1)))
      await retry
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store().status).toBe("loaded")
  })

  it("does nothing on Retry before any request", async () => {
    const { fetchMock } = routeFetch({})

    await act(() => store().retry())

    expect(fetchMock).not.toHaveBeenCalled()
    expect(store().status).toBe("idle")
  })
})

describe("usePlanForecastStore when the plan is out of date", () => {
  it("marks the setup as out of date for a setup key", async () => {
    usePlanSetupStore.getState().setChecked(setup)
    routeFetch({
      [forecastRoute]: () =>
        jsonResponse(400, {
          errors: { "setup.dates[0]": ["Dates cannot be in the past."] },
        }),
    })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("setupOutdated")
    expect(usePlanSetupStore.getState().checked).toBeNull()
    expect(usePlanSetupStore.getState().recheckNotice).toBe(true)
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(false)
  })

  it("marks the activities as out of date for an activity key", async () => {
    usePlanActivitiesStore.getState().setChecked(activities)
    routeFetch({
      [forecastRoute]: () =>
        jsonResponse(400, {
          errors: {
            "activities[0]": ["This activity is no longer available."],
          },
        }),
    })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("activitiesOutdated")
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(true)
    expect(usePlanSetupStore.getState().recheckNotice).toBe(false)
  })

  it("reads the current user again on a 403 and offers Retry meanwhile", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [forecastRoute]: () => jsonResponse(403) })

    await act(() => store().load(setup, activities))

    expect(refresh).toHaveBeenCalledOnce()
    // Not an empty step: if reading the user fails, the page still shows the error with Retry.
    expect(store().status).toBe("serverError")
    expect(store().forecast).toBeNull()
  })
})
