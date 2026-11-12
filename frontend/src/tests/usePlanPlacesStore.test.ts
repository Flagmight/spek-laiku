import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import { planPlaces } from "./placesFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const placesRoute = "POST /api/plan-places"

const setup: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
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
  return usePlanPlacesStore.getState()
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

describe("usePlanPlacesStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is loading while the request runs, then keeps the places", async () => {
    const places = planPlaces(["category-kayaking"])
    const { pending } = stubPendingRequests()

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    expect(store().status).toBe("loading")
    expect(store().places).toBeNull()

    await act(async () => {
      pending[0].resolve(jsonResponse(200, places))
      await load
    })

    expect(store().status).toBe("loaded")
    expect(store().places).toEqual(places)
    expect(store().lastSetup).toBe(setup)
    expect(store().lastActivities).toBe(activities)
  })

  it("sends the same body as the forecast request", async () => {
    const { requests } = routeFetch({
      [placesRoute]: () => jsonResponse(200, planPlaces(["category-kayaking"])),
    })

    await act(() => store().load(setup, activities))

    expect(requests[0].body).toEqual({
      setup: {
        locationId: 598316,
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
      pending[0].resolve(jsonResponse(200, planPlaces(["category-kayaking"])))
      await first
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("aborts on reset and drops the late answer", async () => {
    const { pending } = stubPendingRequests()

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    act(() => store().reset())
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planPlaces(["category-kayaking"])))
      await load
    })

    expect(pending[0].signal.aborted).toBe(true)
    expect(store().status).toBe("idle")
    expect(store().places).toBeNull()
  })

  it("reports a server error and keeps no places for a 500", async () => {
    routeFetch({ [placesRoute]: () => jsonResponse(500) })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("serverError")
    expect(store().places).toBeNull()
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
    stubPendingRequests()

    act(() => {
      void store().load(setup, activities)
    })
    await act(() => vi.advanceTimersByTimeAsync(planRequestTimeoutMs - 1))
    expect(store().status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(store().status).toBe("serverError")
  })
})
