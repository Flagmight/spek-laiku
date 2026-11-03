import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  categoriesTimeoutMs,
  initialActivityCategoriesState,
  useActivityCategoriesStore,
} from "../stores/useActivityCategoriesStore"
import type { ActivityCategory } from "../types/activityCategory"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/admin/categories"

function category(name: string): ActivityCategory {
  return {
    id: `id-${name}`,
    name,
    type: "Indoor",
    defaultDurationHours: 2,
    requiresDaylight: false,
    maxWindMs: null,
    maxRainMmPerHour: null,
    minTemperatureC: null,
    maxTemperatureC: null,
    placeTags: ["tourism=museum"],
    version: 1,
  }
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

// Like routeFetch, but every list request waits until the test answers it.
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

describe("useActivityCategoriesStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is loading, then loaded with the categories in API order", async () => {
    const categories = [category("Museum"), category("Cycling")]
    const { pending } = stubPendingList()
    const { result } = renderHook(() => useActivityCategoriesStore())

    let load: Promise<void> = Promise.resolve()
    act(() => {
      load = result.current.load()
    })
    expect(result.current.status).toBe("loading")

    await act(async () => {
      pending[0].resolve(jsonResponse(200, categories))
      await load
    })

    expect(result.current.status).toBe("loaded")
    expect(result.current.categories).toEqual(categories)
  })

  it.each([500, 503])("reports an error on %i", async (status) => {
    routeFetch({ [listRoute]: () => jsonResponse(status) })
    const { result } = renderHook(() => useActivityCategoriesStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
  })

  it("reports an error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => useActivityCategoriesStore())

    await act(() => result.current.load())

    expect(result.current.status).toBe("error")
  })

  it("reports an error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const { fetchMock } = stubPendingList()
    const { result } = renderHook(() => useActivityCategoriesStore())

    act(() => {
      void result.current.load()
    })
    await act(() => vi.advanceTimersByTimeAsync(categoriesTimeoutMs - 1))
    expect(result.current.status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("error")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("lets a later load win over an earlier slower one", async () => {
    const { fetchMock, pending } = stubPendingList()
    const { result } = renderHook(() => useActivityCategoriesStore())

    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.load()
      second = result.current.load()
    })
    await act(async () => {
      pending[1].resolve(jsonResponse(200, [category("Newer")]))
      await second
      pending[0].resolve(jsonResponse(200, [category("Older")]))
      await first
    })

    expect(result.current.status).toBe("loaded")
    expect(result.current.categories).toEqual([category("Newer")])
    const firstInit = fetchMock.mock.calls[0][1] as RequestInit
    expect(firstInit.signal?.aborted).toBe(true)
  })

  it("reset aborts a pending load and returns to the initial state", async () => {
    const { fetchMock } = stubPendingList()
    const { result } = renderHook(() => useActivityCategoriesStore())

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
    expect(result.current).toMatchObject(initialActivityCategoriesState)
  })
})
