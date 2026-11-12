import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanPlacesStore } from "../stores/usePlanPlacesStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
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

describe("usePlanPlacesStore removing an activity", () => {
  it("drops the activity from what Retry sends and keeps the places", async () => {
    const museum: CheckedPlanActivity = {
      ...activities[0],
      id: "browser-id-2",
      categoryId: "category-museum",
      name: "Museum",
    }
    const places = planPlaces(["category-kayaking", "category-museum"])
    routeFetch({ [placesRoute]: () => jsonResponse(200, places) })
    await act(() => store().load(setup, [...activities, museum]))

    act(() => store().removeActivity(activities[0].id))

    expect(store().lastActivities).toEqual([museum])
    expect(store().places).toEqual(places)
  })

  it("does nothing for an activity it does not know", async () => {
    routeFetch({
      [placesRoute]: () => jsonResponse(200, planPlaces(["category-kayaking"])),
    })
    await act(() => store().load(setup, activities))

    act(() => store().removeActivity("unknown"))

    expect(store().lastActivities).toBe(activities)
  })
})

describe("usePlanPlacesStore failures and Retry", () => {
  it.each([
    [
      "mapUnavailable",
      () => jsonResponse(503, { status: 503, service: "places" }),
    ],
    ["tooManyRequests", () => jsonResponse(429, { status: 429 })],
    [
      "serverError",
      () => jsonResponse(503, { status: 503, service: "locationSearch" }),
    ],
  ] as const)("sets %s and keeps no places", async (status, answer) => {
    routeFetch({ [placesRoute]: answer })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe(status)
    expect(store().places).toBeNull()
  })

  it("is retrying, not loading, while Retry runs, sends the last plan and runs one request at a time", async () => {
    const { fetchMock, pending } = stubPendingRequests()
    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = store().load(setup, activities)
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(503, { status: 503, service: "places" }))
      await load
    })

    let retry: Promise<void> = Promise.resolve()
    act(() => {
      retry = store().retry()
      void store().retry()
      void store().load(setup, activities)
    })
    expect(store().status).toBe("retrying")
    expect(store().places).toBeNull()

    const places = planPlaces(["category-kayaking"])
    await act(async () => {
      pending[1].resolve(jsonResponse(200, places))
      await retry
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][1]?.body).toBe(
      fetchMock.mock.calls[0][1]?.body,
    )
    expect(store().status).toBe("loaded")
    expect(store().places).toEqual(places)
  })

  it("reports a server error when Retry gets no answer within 10 seconds", async () => {
    vi.useFakeTimers()
    routeFetch({ [placesRoute]: () => jsonResponse(500) })
    await act(() => store().load(setup, activities))
    stubPendingRequests()

    act(() => {
      void store().retry()
    })
    await act(() => vi.advanceTimersByTimeAsync(planRequestTimeoutMs))

    expect(store().status).toBe("serverError")
  })

  it("drops a Retry's late answer after reset", async () => {
    routeFetch({ [placesRoute]: () => jsonResponse(500) })
    await act(() => store().load(setup, activities))
    const { pending } = stubPendingRequests()

    let retry: Promise<void> = Promise.resolve()
    act(() => {
      retry = store().retry()
    })
    act(() => store().reset())
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planPlaces(["category-kayaking"])))
      await retry
    })

    expect(store().status).toBe("idle")
    expect(store().places).toBeNull()
  })
})

describe("usePlanPlacesStore when the plan is out of date", () => {
  it("marks the setup as out of date for a setup key and keeps no places", async () => {
    usePlanSetupStore.getState().setChecked(setup)
    routeFetch({
      [placesRoute]: () =>
        jsonResponse(400, {
          errors: {
            "setup.locationId": [
              "Select a location in Lithuania from the list.",
            ],
          },
        }),
    })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("setupOutdated")
    expect(store().places).toBeNull()
    expect(usePlanSetupStore.getState().checked).toBeNull()
    expect(usePlanSetupStore.getState().recheckNotice).toBe(true)
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(false)
  })

  it("marks the activities as out of date for an activity key", async () => {
    usePlanActivitiesStore.getState().setChecked(activities)
    routeFetch({
      [placesRoute]: () =>
        jsonResponse(400, {
          errors: {
            "activities[0]": [
              "This activity is no longer available. Remove it.",
            ],
          },
        }),
    })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("activitiesOutdated")
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(true)
  })

  it("reads the current user again on a 403 and offers Retry meanwhile", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [placesRoute]: () => jsonResponse(403) })

    await act(() => store().load(setup, activities))

    expect(refresh).toHaveBeenCalledOnce()
    // Not an empty step: if reading the user fails, the page still shows the error with Retry.
    expect(store().status).toBe("serverError")
    expect(store().places).toBeNull()
  })

  it("reports a server error for a 400 that names neither part", async () => {
    routeFetch({
      [placesRoute]: () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    })

    await act(() => store().load(setup, activities))

    expect(store().status).toBe("serverError")
  })
})
