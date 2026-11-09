import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  initialPlanCategoriesState,
  planCategoriesTimeoutMs,
  usePlanCategoriesStore,
} from "../stores/usePlanCategoriesStore"
import type { PlanCategory } from "../types/planActivity"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/plan-activities/categories"

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

const list = { categories: [museum], maxActivities: 10 }

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

function stubPendingList() {
  const pending: ReturnType<typeof deferred>[] = []
  const fetchMock = vi.fn((_path: string, init?: RequestInit) => {
    const response = deferred(init)
    pending.push(response)
    return response.promise
  })
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, pending }
}

describe("usePlanCategoriesStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is loading, then loaded with the categories and the server's limit", async () => {
    const { fetchMock, pending } = stubPendingList()
    const { result } = renderHook(() => usePlanCategoriesStore())

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = result.current.load()
    })
    expect(result.current.status).toBe("loading")
    expect(result.current.maxActivities).toBeNull()

    await act(async () => {
      pending[0].resolve(
        jsonResponse(200, { categories: [museum], maxActivities: 3 }),
      )
      await load
    })

    expect(result.current.status).toBe("loaded")
    expect(result.current.categories).toEqual([museum])
    expect(result.current.maxActivities).toBe(3)
    expect(fetchMock.mock.calls[0][0]).toBe("/api/plan-activities/categories")
  })

  it("reports an error on a 500", async () => {
    routeFetch({ [listRoute]: () => jsonResponse(500) })
    const { result } = renderHook(() => usePlanCategoriesStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
    expect(result.current.categories).toEqual([])
    expect(result.current.maxActivities).toBeNull()
  })

  it("reports an error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => usePlanCategoriesStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
  })

  it("reports an error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { fetchMock } = stubPendingList()
    const { result } = renderHook(() => usePlanCategoriesStore())

    act(() => {
      void result.current.load()
    })
    await act(() => vi.advanceTimersByTimeAsync(planCategoriesTimeoutMs - 1))
    expect(result.current.status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(planCategoriesTimeoutMs).toBe(10_000)
    expect(result.current.status).toBe("error")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("loads again after an error, as Retry does", async () => {
    let answer = jsonResponse(500)
    routeFetch({ [listRoute]: () => answer })
    const { result } = renderHook(() => usePlanCategoriesStore())
    await act(() => result.current.load())
    expect(result.current.status).toBe("error")

    answer = jsonResponse(200, list)
    await act(() => result.current.load())

    expect(result.current.status).toBe("loaded")
    expect(result.current.categories).toEqual([museum])
  })

  it("ignores an older answer that arrives after a newer load", async () => {
    const { fetchMock, pending } = stubPendingList()
    const { result } = renderHook(() => usePlanCategoriesStore())

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.load()
      second = result.current.load()
    })
    await act(async () => {
      pending[1].resolve(jsonResponse(200, list))
      await second
      pending[0].resolve(
        jsonResponse(200, { categories: [], maxActivities: 1 }),
      )
      await first
    })

    expect(result.current.categories).toEqual([museum])
    expect(result.current.maxActivities).toBe(10)
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(firstInit.signal?.aborted).toBe(true)
  })

  it("reset aborts a pending load and drops its result", async () => {
    const { fetchMock } = stubPendingList()
    const { result } = renderHook(() => usePlanCategoriesStore())

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
    expect(result.current).toMatchObject(initialPlanCategoriesState)
  })
})
