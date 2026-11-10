import { act } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { usePlanForecastStore } from "../stores/usePlanForecastStore"
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
