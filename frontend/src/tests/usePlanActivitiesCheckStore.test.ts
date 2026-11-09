import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  initialPlanActivitiesCheckState,
  planActivitiesCheckTimeoutMs,
  usePlanActivitiesCheckStore,
} from "../stores/usePlanActivitiesCheckStore"
import { usePlanActivitiesStore } from "../stores/usePlanActivitiesStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { PlanCategory } from "../types/planActivity"
import { jsonResponse, routeFetch } from "./renderApp"

const checkRoute = "POST /api/plan-activities/check"

const cycling: PlanCategory = {
  id: "category-cycling",
  name: "Cycling",
  type: "Outdoor",
  defaultDurationHours: 3,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 1,
  minTemperatureC: 5,
  maxTemperatureC: 30,
}

const museum: PlanCategory = {
  id: "category-museum",
  name: "Museum",
  type: "Indoor",
  defaultDurationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

const checkedCycling = {
  categoryId: cycling.id,
  name: "Cycling today",
  type: "Outdoor",
  durationHours: 3,
  requiresDaylight: true,
  maxWindMs: 10,
  maxRainMmPerHour: 1,
  minTemperatureC: 5,
  maxTemperatureC: 30,
}

const checkedMuseum = {
  categoryId: museum.id,
  name: "Museum",
  type: "Indoor",
  durationHours: 2,
  requiresDaylight: false,
  maxWindMs: null,
  maxRainMmPerHour: null,
  minTemperatureC: null,
  maxTemperatureC: null,
}

const accepted = { activities: [checkedCycling, checkedMuseum] }

function store() {
  return usePlanActivitiesCheckStore.getState()
}

function plan() {
  usePlanActivitiesStore.getState().add(cycling)
  usePlanActivitiesStore.getState().add(museum)
  return usePlanActivitiesStore.getState().activities
}

// Every check waits until the test answers it, and rejects when it is aborted.
function stubPendingChecks() {
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

describe("usePlanActivitiesCheckStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is pending while the check runs and ignores a second submit", async () => {
    const { fetchMock, pending } = stubPendingChecks()
    const activities = plan()

    let first: Promise<boolean> = Promise.resolve(false)
    let second: Promise<boolean> = Promise.resolve(false)
    act(() => {
      first = store().submit(activities)
      second = store().submit(activities)
    })
    expect(store().status).toBe("pending")
    expect(await second).toBe(false)

    await act(async () => {
      pending[0].resolve(jsonResponse(200, accepted))
      await first
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps the server's activities as checked, matched to the sent ids", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(200, accepted) })
    const activities = plan()

    expect(await act(() => store().submit(activities))).toBe(true)

    expect(store().status).toBe("idle")
    expect(usePlanActivitiesStore.getState().checked).toEqual([
      { ...checkedCycling, id: activities[0].id },
      { ...checkedMuseum, id: activities[1].id },
    ])
  })

  it("turns the server's keys into errors by the sent activity's id", async () => {
    routeFetch({
      [checkRoute]: () =>
        jsonResponse(400, {
          errors: {
            activities: ["You can add up to 10 activities."],
            "activities[0]": [
              "This activity is no longer available. Remove it.",
            ],
            "activities[1].durationHours": ["Enter a duration."],
          },
        }),
    })
    const activities = plan()

    expect(await act(() => store().submit(activities))).toBe(false)

    expect(store().status).toBe("invalid")
    expect(store().errors).toEqual({
      list: "You can add up to 10 activities.",
      byActivity: {
        [activities[0].id]: {
          activity: "This activity is no longer available. Remove it.",
        },
        [activities[1].id]: { durationHours: "Enter a duration." },
      },
    })
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
  })

  it.each([
    ["a 500", () => Promise.resolve(jsonResponse(500))],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])(
    "reports a server error for %s and keeps the activities for Retry",
    async (_case, answer) => {
      vi.stubGlobal("fetch", vi.fn(answer))
      const activities = plan()

      await act(() => store().submit(activities))

      expect(store().status).toBe("serverError")
      expect(store().lastRequest).toBe(activities)
    },
  )

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { pending } = stubPendingChecks()
    const activities = plan()

    act(() => {
      void store().submit(activities)
    })
    await act(() =>
      vi.advanceTimersByTimeAsync(planActivitiesCheckTimeoutMs - 1),
    )
    expect(store().status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(planActivitiesCheckTimeoutMs).toBe(10_000)
    expect(store().status).toBe("serverError")
    expect(pending[0].signal.aborted).toBe(true)
  })

  it("sends the same request on Retry", async () => {
    let answer = jsonResponse(500)
    const { requests } = routeFetch({ [checkRoute]: () => answer })
    const activities = plan()
    await act(() => store().submit(activities))

    answer = jsonResponse(200, accepted)
    expect(await act(() => store().retry())).toBe(true)

    expect(requests).toHaveLength(2)
    expect(requests[1].body).toEqual(requests[0].body)
  })

  it("reads the signed-in user again on 403", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(403) })
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    const activities = plan()

    expect(await act(() => store().submit(activities))).toBe(false)

    expect(refresh).toHaveBeenCalled()
    expect(store().status).toBe("idle")
  })

  it("drops an answer for activities changed while the check ran", async () => {
    const { pending } = stubPendingChecks()
    const activities = plan()

    let submit: Promise<boolean> = Promise.resolve(false)
    act(() => {
      submit = store().submit(activities)
    })
    act(() => {
      usePlanActivitiesStore
        .getState()
        .update(activities[0].id, { durationText: "4" })
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(200, accepted))
      await submit
    })

    expect(await submit).toBe(false)
    expect(store().status).toBe("idle")
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
  })

  it("reset() aborts a pending check and drops its result", async () => {
    const { pending } = stubPendingChecks()
    const activities = plan()

    let submit: Promise<boolean> = Promise.resolve(false)
    act(() => {
      submit = store().submit(activities)
    })
    act(() => store().reset())

    expect(pending[0].signal.aborted).toBe(true)
    expect(await submit).toBe(false)
    expect(store()).toMatchObject(initialPlanActivitiesCheckState)
    expect(usePlanActivitiesStore.getState().checked).toBeNull()
  })
})
