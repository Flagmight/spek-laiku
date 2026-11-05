import { act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  initialPlanSetupCheckState,
  planSetupCheckTimeoutMs,
  usePlanSetupCheckStore,
} from "../stores/usePlanSetupCheckStore"
import { usePlanSetupStore } from "../stores/usePlanSetupStore"
import type {
  CheckedPlanSetup,
  PlanSetupCheckRequest,
} from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const checkRoute = "POST /api/plan-setup/check"

const request: PlanSetupCheckRequest = {
  locationId: 598316,
  dates: ["2026-11-07"],
  maxTravelDistanceKm: null,
}

const checked: CheckedPlanSetup = {
  location: {
    id: 598316,
    name: "Kaunas",
    area: "Kaunas County",
    latitude: 54.90156,
    longitude: 23.90909,
  },
  dates: ["2026-11-07"],
  maxTravelDistanceKm: 30,
}

function store() {
  return usePlanSetupCheckStore.getState()
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

describe("usePlanSetupCheckStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is pending while the check runs and ignores a second submit", async () => {
    const { fetchMock, pending } = stubPendingChecks()

    let first: Promise<boolean> = Promise.resolve(false)
    let second: Promise<boolean> = Promise.resolve(false)
    act(() => {
      first = store().submit(request)
      second = store().submit(request)
    })
    expect(store().status).toBe("pending")
    expect(await second).toBe(false)

    await act(async () => {
      pending[0].resolve(jsonResponse(200, checked))
      await first
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("keeps an accepted setup as checked and resolves true", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(200, checked) })

    const accepted = await act(() => store().submit(request))

    expect(accepted).toBe(true)
    expect(store().status).toBe("idle")
    expect(usePlanSetupStore.getState().checked).toEqual(checked)
  })

  it("keeps the field errors when the setup is refused", async () => {
    routeFetch({
      [checkRoute]: () =>
        jsonResponse(400, {
          errors: { "dates[0]": ["Dates cannot be in the past."] },
        }),
    })

    const accepted = await act(() => store().submit(request))

    expect(accepted).toBe(false)
    expect(store().status).toBe("invalid")
    expect(store().errors).toEqual({
      "dates[0]": "Dates cannot be in the past.",
    })
    expect(store().lastRequest).toEqual(request)
    expect(usePlanSetupStore.getState().checked).toBeNull()
  })

  it("reports too many requests and lets Retry send the same values", async () => {
    let answer = jsonResponse(429)
    const { requests } = routeFetch({ [checkRoute]: () => answer })
    await act(() => store().submit(request))
    expect(store().status).toBe("tooManyRequests")

    answer = jsonResponse(200, checked)
    const accepted = await act(() => store().retry())

    expect(accepted).toBe(true)
    expect(requests.map((sent) => sent.body)).toEqual([request, request])
  })

  it.each([
    ["a 500", () => Promise.resolve(jsonResponse(500))],
    ["a 503", () => Promise.resolve(jsonResponse(503))],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])(
    "reports a server error for %s and keeps the request for Retry",
    async (_case, answer) => {
      vi.stubGlobal("fetch", vi.fn(answer))

      await act(() => store().submit(request))

      expect(store().status).toBe("serverError")
      expect(store().lastRequest).toEqual(request)
    },
  )

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { pending } = stubPendingChecks()

    act(() => {
      void store().submit(request)
    })
    await act(() => vi.advanceTimersByTimeAsync(planSetupCheckTimeoutMs - 1))
    expect(store().status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(store().status).toBe("serverError")
    expect(pending[0].signal.aborted).toBe(true)
  })

  it("reads the signed-in user again on 403", async () => {
    routeFetch({ [checkRoute]: () => jsonResponse(403) })
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()

    const accepted = await act(() => store().submit(request))

    expect(accepted).toBe(false)
    expect(refresh).toHaveBeenCalled()
    expect(store().status).toBe("idle")
  })

  it("drops an answer for values the user changed while the check ran", async () => {
    const { pending } = stubPendingChecks()
    usePlanSetupStore.getState().chooseLocation(checked.location)
    usePlanSetupStore.getState().addDate("2026-11-07")

    let submit: Promise<boolean> = Promise.resolve(false)
    act(() => {
      submit = store().submit(request)
    })
    act(() => {
      usePlanSetupStore.getState().addDate("2026-11-08")
      usePlanSetupStore.getState().setMaxTravelDistanceText("50")
    })
    await act(async () => {
      pending[0].resolve(jsonResponse(200, checked))
      await submit
    })

    expect(await submit).toBe(false)
    expect(store().status).toBe("idle")
    expect(usePlanSetupStore.getState()).toMatchObject({
      checked: null,
      dates: ["2026-11-07", "2026-11-08"],
      maxTravelDistanceText: "50",
    })
  })

  it("reset() aborts a pending check and drops its result", async () => {
    const { pending } = stubPendingChecks()

    let submit: Promise<boolean> = Promise.resolve(false)
    act(() => {
      submit = store().submit(request)
    })
    act(() => store().reset())

    expect(pending[0].signal.aborted).toBe(true)
    expect(await submit).toBe(false)
    expect(store()).toMatchObject(initialPlanSetupCheckState)
    expect(usePlanSetupStore.getState().checked).toBeNull()
  })
})
