import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useActivityCategoriesStore } from "../stores/useActivityCategoriesStore"
import {
  categoryFormTimeoutMs,
  initialCategoryFormState,
  useCategoryFormStore,
} from "../stores/useCategoryFormStore"
import type { CategoryFormState } from "../stores/useCategoryFormStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type {
  ActivityCategory,
  ActivityCategoryRequest,
} from "../types/activityCategory"
import { jsonResponse, routeFetch } from "./renderApp"

const createRoute = "POST /api/admin/categories"
const listRoute = "GET /api/admin/categories"

const request: ActivityCategoryRequest = {
  name: "Swimming",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
  placeTags: "leisure=bathing_place, sport=swimming",
}

const swimming: ActivityCategory = {
  id: "6c1f0d1e-6a43-4b8e-9d0a-1f2a3b4c5d6e",
  name: "Swimming",
  type: "Outdoor",
  defaultDurationHours: 2,
  requiresDaylight: true,
  maxWindMs: 8,
  maxRainMmPerHour: 0.5,
  minTemperatureC: 18,
  maxTemperatureC: 35,
  placeTags: ["leisure=bathing_place", "sport=swimming"],
  version: 1,
}

// A save that only ends when it is aborted, like a server that never answers.
function stubHangingFetch() {
  const fetchMock = vi.fn(
    (_path: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The request was aborted.", "AbortError")),
        )
      }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

async function submit(result: { current: CategoryFormState }) {
  let saved: ActivityCategory | undefined
  await act(async () => {
    saved = await result.current.submit(request)
  })
  return saved
}

describe("useCategoryFormStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is pending while the save is in progress", () => {
    stubHangingFetch()
    const { result } = renderHook(() => useCategoryFormStore())

    act(() => {
      void result.current.submit(request)
    })

    expect(result.current.status).toBe("pending")
  })

  it("on 201 returns to idle, resolves with the category and reloads the list", async () => {
    const { requests } = routeFetch({
      [createRoute]: () => jsonResponse(201, swimming),
      [listRoute]: () => jsonResponse(200, [swimming]),
    })
    const load = vi.spyOn(useActivityCategoriesStore.getState(), "load")
    const { result } = renderHook(() => useCategoryFormStore())

    const saved = await submit(result)

    expect(saved).toEqual(swimming)
    expect(result.current.status).toBe("idle")
    expect(requests[0].body).toEqual(request)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("ignores a second submit while a save is pending", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useCategoryFormStore())

    let second: unknown = null
    await act(async () => {
      void result.current.submit(request)
      second = await result.current.submit(request)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBeUndefined()
  })

  it("sets the field errors on 400", async () => {
    routeFetch({
      [createRoute]: () =>
        jsonResponse(400, {
          errors: { name: ["A category with this name already exists."] },
        }),
    })
    const { result } = renderHook(() => useCategoryFormStore())

    const saved = await submit(result)

    expect(saved).toBeUndefined()
    expect(result.current.status).toBe("invalid")
    expect(result.current.errors).toEqual({
      name: "A category with this name already exists.",
    })
  })

  it.each([500, 503])("reports a server error on %i", async (status) => {
    routeFetch({ [createRoute]: () => jsonResponse(status) })
    const { result } = renderHook(() => useCategoryFormStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => useCategoryFormStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useCategoryFormStore())

    act(() => {
      void result.current.submit(request)
    })
    await act(() => vi.advanceTimersByTimeAsync(categoryFormTimeoutMs - 1))
    expect(result.current.status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("serverError")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("retry sends the last request again", async () => {
    let respond = () => jsonResponse(500)
    const { requests } = routeFetch({
      [createRoute]: () => respond(),
      [listRoute]: () => jsonResponse(200, [swimming]),
    })
    const { result } = renderHook(() => useCategoryFormStore())
    await submit(result)
    expect(result.current.status).toBe("serverError")

    respond = () => jsonResponse(201, swimming)
    let saved: ActivityCategory | undefined
    await act(async () => {
      saved = await result.current.retry()
    })

    expect(saved).toEqual(swimming)
    const saves = requests.filter((sent) => sent.method === "POST")
    expect(saves).toHaveLength(2)
    expect(saves[1].body).toEqual(saves[0].body)
  })

  it("reset aborts a pending save, drops its result and starts idle", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useCategoryFormStore())

    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.submit(request)
    })
    let saved: unknown = null
    await act(async () => {
      result.current.reset()
      saved = await pending
    })

    expect(saved).toBeUndefined()
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
    expect(result.current).toMatchObject(initialCategoryFormState)
  })

  it("marks the session as ended on 401", async () => {
    routeFetch({ [createRoute]: () => jsonResponse(401) })
    const markSessionEnded = vi.spyOn(
      useCurrentUserStore.getState(),
      "markSessionEnded",
    )
    const { result } = renderHook(() => useCategoryFormStore())

    await submit(result)

    expect(markSessionEnded).toHaveBeenCalledTimes(1)
  })

  it("reads the signed-in user again on 403", async () => {
    routeFetch({ [createRoute]: () => jsonResponse(403) })
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    const { result } = renderHook(() => useCategoryFormStore())

    await submit(result)

    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
