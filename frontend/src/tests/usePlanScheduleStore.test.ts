import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { usePlanScheduleStore } from "../stores/usePlanScheduleStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type { CheckedPlanActivity } from "../types/planActivity"
import type { CheckedPlanSetup } from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const scheduleRoute = "POST /api/plan-schedule"

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

const planSchedule = {
  generatedScheduleId: "6f1c2a8e-3b7d-4e55-9a10-0c4f2d9b7e31",
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

function store() {
  return usePlanScheduleStore.getState()
}

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

describe("usePlanScheduleStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts idle with no schedule", () => {
    expect(store().status).toBe("idle")
    expect(store().schedule).toBeNull()
  })

  it("is loading while the request runs, then keeps the schedule", async () => {
    const { pending } = stubPendingRequests()

    let generate: Promise<void> = Promise.resolve()
    act(() => {
      generate = store().generate(setup, activities)
    })
    expect(store().status).toBe("loading")
    expect(store().schedule).toBeNull()

    await act(async () => {
      pending[0].resolve(jsonResponse(200, planSchedule))
      await generate
    })

    expect(store().status).toBe("loaded")
    expect(store().schedule).toEqual(planSchedule)
  })

  it("ignores a second generate while loading", async () => {
    const { fetchMock, pending } = stubPendingRequests()

    let first: Promise<void> = Promise.resolve()
    act(() => {
      first = store().generate(setup, activities)
      void store().generate(setup, activities)
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planSchedule))
      await first
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("aborts on reset and drops the late answer", async () => {
    const { pending } = stubPendingRequests()

    let generate: Promise<void> = Promise.resolve()
    act(() => {
      generate = store().generate(setup, activities)
    })
    act(() => store().reset())
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planSchedule))
      await generate
    })

    expect(pending[0].signal.aborted).toBe(true)
    expect(store().status).toBe("idle")
    expect(store().schedule).toBeNull()
  })

  it("reports a server error and keeps no schedule for a 500", async () => {
    routeFetch({ [scheduleRoute]: () => jsonResponse(500) })

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe("serverError")
    expect(store().schedule).toBeNull()
  })

  it("reports a server error for a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe("serverError")
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    stubPendingRequests()

    act(() => {
      void store().generate(setup, activities)
    })
    await act(() => vi.advanceTimersByTimeAsync(planRequestTimeoutMs - 1))
    expect(store().status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(store().status).toBe("serverError")
  })
})

describe("usePlanScheduleStore retry", () => {
  it("re-runs the request and returns to loaded on success", async () => {
    const { fetchMock, pending } = stubPendingRequests()

    let generate: Promise<void> = Promise.resolve()
    act(() => {
      generate = store().generate(setup, activities)
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(500))
      await generate
    })
    expect(store().status).toBe("serverError")

    let retry: Promise<void> = Promise.resolve()
    act(() => {
      retry = store().retry()
    })
    expect(store().status).toBe("loading")

    await act(async () => {
      pending[1].resolve(jsonResponse(200, planSchedule))
      await retry
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store().status).toBe("loaded")
    expect(store().schedule).toEqual(planSchedule)
  })

  it("ignores retry while already loading", async () => {
    const { fetchMock, pending } = stubPendingRequests()

    let generate: Promise<void> = Promise.resolve()
    act(() => {
      generate = store().generate(setup, activities)
      void store().retry()
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planSchedule))
      await generate
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("drops a retry answer after reset", async () => {
    routeFetch({ [scheduleRoute]: () => jsonResponse(500) })
    await act(() => store().generate(setup, activities))
    const { pending } = stubPendingRequests()

    let retry: Promise<void> = Promise.resolve()
    act(() => {
      retry = store().retry()
    })
    act(() => store().reset())
    await act(async () => {
      pending[0].resolve(jsonResponse(200, planSchedule))
      await retry
    })

    expect(store().status).toBe("idle")
    expect(store().schedule).toBeNull()
  })
})

describe("usePlanScheduleStore service failures", () => {
  it.each([
    [
      "weatherUnavailable",
      () => jsonResponse(503, { status: 503, service: "forecast" }),
    ],
    [
      "placesUnavailable",
      () => jsonResponse(503, { status: 503, service: "places" }),
    ],
    ["tooManyRequests", () => jsonResponse(429, { status: 429 })],
    [
      "serverError",
      () => jsonResponse(503, { status: 503, service: "locationSearch" }),
    ],
  ] as const)("sets %s and keeps no schedule", async (status, answer) => {
    routeFetch({ [scheduleRoute]: answer })

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe(status)
    expect(store().schedule).toBeNull()
  })
})

describe("usePlanScheduleStore when the plan is out of date", () => {
  it("marks the setup as out of date for a setup key and keeps no schedule", async () => {
    usePlanSetupStore.getState().setChecked(setup)
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(400, {
          errors: {
            "setup.locationId": [
              "Select a location in Lithuania from the list.",
            ],
          },
        }),
    })

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe("setupOutdated")
    expect(store().schedule).toBeNull()
    expect(usePlanSetupStore.getState().checked).toBeNull()
    expect(usePlanSetupStore.getState().recheckNotice).toBe(true)
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(false)
  })

  it("marks the activities as out of date for an activity key", async () => {
    usePlanActivitiesStore.getState().setChecked(activities)
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(400, {
          errors: {
            "activities[0]": [
              "This activity is no longer available. Remove it.",
            ],
          },
        }),
    })

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe("activitiesOutdated")
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
    expect(usePlanActivitiesStore.getState().recheckNotice).toBe(true)
  })

  it("reads the current user again on a 403 and offers Retry meanwhile", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [scheduleRoute]: () => jsonResponse(403) })

    await act(() => store().generate(setup, activities))

    expect(refresh).toHaveBeenCalledOnce()
    expect(store().status).toBe("serverError")
    expect(store().schedule).toBeNull()
  })

  it("reports a server error for a 400 that names neither part", async () => {
    routeFetch({
      [scheduleRoute]: () =>
        jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    })

    await act(() => store().generate(setup, activities))

    expect(store().status).toBe("serverError")
  })
})
