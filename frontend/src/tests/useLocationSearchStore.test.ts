import { act } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  initialLocationSearchState,
  locationSearchPauseMs,
  locationSearchTimeoutMs,
  useLocationSearchStore,
} from "../stores/useLocationSearchStore"
import type { PlanLocation } from "../types/planSetup"
import { jsonResponse } from "./renderApp"

const kaunas: PlanLocation = {
  id: 598316,
  name: "Kaunas",
  area: "Kaunas County",
  latitude: 54.90156,
  longitude: 23.90909,
}

// Every request waits until the test answers it, and rejects when it is aborted.
function stubPendingSearches() {
  const pending: {
    path: string
    signal: AbortSignal
    resolve: (response: Response) => void
    reject: (error: unknown) => void
  }[] = []
  const fetchMock = vi.fn(
    (path: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const signal = init!.signal!
        pending.push({ path, signal, resolve, reject })
        signal.addEventListener("abort", () =>
          reject(new DOMException("The request was aborted.", "AbortError")),
        )
      }),
  )
  vi.stubGlobal("fetch", fetchMock)
  return { fetchMock, pending }
}

function store() {
  return useLocationSearchStore.getState()
}

async function type(text: string) {
  act(() => store().queryChanged(text))
  await act(() => vi.advanceTimersByTimeAsync(locationSearchPauseMs))
}

async function answer(response: Response | Error, index = 0) {
  const { pending } = searches
  await act(async () => {
    if (response instanceof Error) {
      pending[index].reject(response)
    } else {
      pending[index].resolve(response)
    }
    await vi.advanceTimersByTimeAsync(0)
  })
}

let searches: ReturnType<typeof stubPendingSearches>

describe("useLocationSearchStore", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searches = stubPendingSearches()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits 300 ms after the last change before searching", async () => {
    act(() => store().queryChanged("Ka"))
    await act(() => vi.advanceTimersByTimeAsync(locationSearchPauseMs - 1))
    act(() => store().queryChanged("Kau"))
    await act(() => vi.advanceTimersByTimeAsync(locationSearchPauseMs - 1))
    expect(searches.fetchMock).not.toHaveBeenCalled()

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(searches.fetchMock).toHaveBeenCalledTimes(1)
    expect(searches.pending[0].path).toBe("/api/locations?query=Kau")
  })

  it.each(["", "K", "  K  ", "   "])(
    "stays idle and sends nothing for %j",
    async (text) => {
      await type(text)

      expect(store().status).toBe("idle")
      expect(searches.fetchMock).not.toHaveBeenCalled()
    },
  )

  it("sends the trimmed text", async () => {
    await type("  Kaunas ")

    expect(searches.pending[0].path).toBe("/api/locations?query=Kaunas")
  })

  it("is loading while the search runs, then loaded with the places", async () => {
    await type("Kaun")
    expect(store().status).toBe("loading")

    await answer(jsonResponse(200, { locations: [kaunas] }))

    expect(store().status).toBe("loaded")
    expect(store().results).toEqual([kaunas])
  })

  it("is empty when nothing is found", async () => {
    await type("zzqxw")

    await answer(jsonResponse(200, { locations: [] }))

    expect(store().status).toBe("empty")
    expect(store().results).toEqual([])
  })

  it("reports too many requests on 429", async () => {
    await type("Kaun")

    await answer(jsonResponse(429))

    expect(store().status).toBe("tooManyRequests")
    expect(store().results).toEqual([])
  })

  it.each([503, 500, 400])(
    "reports the service unavailable on %i",
    async (status) => {
      await type("Kaun")

      await answer(jsonResponse(status))

      expect(store().status).toBe("unavailable")
    },
  )

  it("reports the service unavailable when the network fails", async () => {
    await type("Kaun")

    await answer(new TypeError("Failed to fetch"))

    expect(store().status).toBe("unavailable")
  })

  it("reports the service unavailable after 10 seconds without an answer, not before", async () => {
    await type("Kaun")
    await act(() => vi.advanceTimersByTimeAsync(locationSearchTimeoutMs - 1))
    expect(store().status).toBe("loading")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(store().status).toBe("unavailable")
    expect(searches.pending[0].signal.aborted).toBe(true)
  })

  it("clears earlier places as soon as the text changes", async () => {
    await type("Kaun")
    await answer(jsonResponse(200, { locations: [kaunas] }))

    act(() => store().queryChanged("Vilni"))

    expect(store().status).toBe("idle")
    expect(store().results).toEqual([])
  })

  it("aborts an older search and never shows its late answer", async () => {
    await type("Kaun")
    await type("Vilni")
    expect(searches.pending[0].signal.aborted).toBe(true)

    await answer(jsonResponse(200, { locations: [] }), 1)

    expect(store().status).toBe("empty")
    expect(store().results).toEqual([])
  })

  it("reset() aborts the search, cancels a waiting one and returns to idle", async () => {
    await type("Kaun")
    act(() => store().queryChanged("Vilni"))

    act(() => store().reset())
    await act(() => vi.advanceTimersByTimeAsync(locationSearchPauseMs))

    expect(searches.pending[0].signal.aborted).toBe(true)
    expect(searches.fetchMock).toHaveBeenCalledTimes(1)
    expect(store()).toMatchObject(initialLocationSearchState)
  })
})
