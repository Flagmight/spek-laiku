import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  initialPlanPeriodState,
  planPeriodTimeoutMs,
  usePlanPeriodStore,
} from "../stores/usePlanPeriodStore"
import type { PlanPeriod } from "../types/planSetup"
import { jsonResponse, routeFetch } from "./renderApp"

const periodRoute = "GET /api/plan-setup/period"

const period: PlanPeriod = {
  firstDate: "2026-11-04",
  lastDate: "2026-11-10",
  maxDates: 7,
}

// A response that only arrives when resolve is called, or rejects when the request is aborted.
function deferred(init?: RequestInit) {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>((resolvePromise, reject) => {
    resolve = resolvePromise
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("The request was aborted.", "AbortError")),
    )
  })
  return { promise, resolve }
}

function stubPendingPeriod() {
  const pending: ReturnType<typeof deferred>[] = []
  const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
    const response = deferred(init)
    pending.push(response)
    return response.promise
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, pending }
}

describe("usePlanPeriodStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is loading, then loaded with the server's values unchanged", async () => {
    const { fetchMock, pending } = stubPendingPeriod()
    const { result } = renderHook(() => usePlanPeriodStore())

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = result.current.load()
    })
    expect(result.current.status).toBe("loading")

    await act(async () => {
      pending[0].resolve(
        jsonResponse(200, {
          firstDate: "2030-01-30",
          lastDate: "2030-02-02",
          maxDates: 3,
        }),
      )
      await load
    })

    expect(result.current.status).toBe("loaded")
    expect(result.current.period).toEqual({
      firstDate: "2030-01-30",
      lastDate: "2030-02-02",
      maxDates: 3,
    })
    expect(fetchMock.mock.calls[0][0]).toBe("/api/plan-setup/period")
  })

  it.each([500, 403])("reports an error on %i", async (status) => {
    routeFetch({ [periodRoute]: () => jsonResponse(status) })
    const { result } = renderHook(() => usePlanPeriodStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
    expect(result.current.period).toBeNull()
  })

  it("reports an error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => usePlanPeriodStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
  })

  it("reports an error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { fetchMock } = stubPendingPeriod()
    const { result } = renderHook(() => usePlanPeriodStore())

    act(() => {
      void result.current.load()
    })
    await act(() => vi.advanceTimersByTimeAsync(planPeriodTimeoutMs - 1))
    expect(result.current.status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("error")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("loads again after an error, as Retry does", async () => {
    let answer = jsonResponse(500)
    routeFetch({ [periodRoute]: () => answer })
    const { result } = renderHook(() => usePlanPeriodStore())
    await act(() => result.current.load())
    expect(result.current.status).toBe("error")

    answer = jsonResponse(200, period)
    await act(() => result.current.load())

    expect(result.current.status).toBe("loaded")
    expect(result.current.period).toEqual(period)
  })

  it("ignores an older answer that arrives after a newer load", async () => {
    const { fetchMock, pending } = stubPendingPeriod()
    const { result } = renderHook(() => usePlanPeriodStore())

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.load()
      second = result.current.load()
    })
    await act(async () => {
      pending[1].resolve(jsonResponse(200, period))
      await second
      pending[0].resolve(
        jsonResponse(200, { ...period, firstDate: "2026-11-03" }),
      )
      await first
    })

    expect(result.current.period).toEqual(period)
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(firstInit.signal?.aborted).toBe(true)
  })

  it("reset aborts a pending load and returns to the initial state", async () => {
    const { fetchMock } = stubPendingPeriod()
    const { result } = renderHook(() => usePlanPeriodStore())

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = result.current.load()
    })
    await act(async () => {
      result.current.reset()
      await load
    })

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
    expect(result.current).toMatchObject(initialPlanPeriodState)
  })
})
