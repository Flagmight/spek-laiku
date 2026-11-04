import { create } from "zustand"
import { ApiError } from "../api/apiClient"
import { searchLocations } from "../api/locationsApi"
import type { PlanLocation } from "../types/planSetup"

// A search starts after this pause in typing, so typing "Kaunas" sends one request, not six.
export const locationSearchPauseMs = 300
// After this long without an answer the search counts as unavailable (spec FR-007).
export const locationSearchTimeoutMs = 10_000
// Shorter text starts no search and shows no message (spec edge cases).
export const minLocationQueryLength = 2

export type LocationSearchStatus =
  "idle" | "loading" | "loaded" | "empty" | "unavailable" | "tooManyRequests"

export interface LocationSearchState {
  status: LocationSearchStatus
  results: PlanLocation[]
  controller: AbortController | null
  pause: ReturnType<typeof setTimeout> | null
  // Called on every change of the Location text. Earlier places are cleared at once, so a place
  // from an older text can never be chosen.
  queryChanged: (text: string) => void
  // Cancels a waiting or running search and returns to idle, for example after a place is chosen.
  reset: () => void
}

export const initialLocationSearchState: Pick<
  LocationSearchState,
  "status" | "results" | "controller" | "pause"
> = { status: "idle", results: [], controller: null, pause: null }

type SearchResult = Pick<LocationSearchState, "status" | "results">

export const useLocationSearchStore = create<LocationSearchState>()((
  set,
  get,
) => {
  function cancel() {
    const { pause, controller } = get()
    if (pause) {
      clearTimeout(pause)
    }
    controller?.abort()
  }

  async function search(query: string) {
    const abort = new AbortController()
    set({ status: "loading", results: [], controller: abort, pause: null })
    const timeout = setTimeout(() => abort.abort(), locationSearchTimeoutMs)
    let result: SearchResult
    try {
      const results = await searchLocations(query, abort.signal)
      result =
        results.length > 0
          ? { status: "loaded", results }
          : { status: "empty", results: [] }
    } catch (error) {
      // No old or invented places are shown after a failure (spec FR-007).
      const tooMany = error instanceof ApiError && error.status === 429
      result = {
        status: tooMany ? "tooManyRequests" : "unavailable",
        results: [],
      }
    } finally {
      clearTimeout(timeout)
    }

    // A newer search or reset() has taken over, so this result is dropped.
    if (get().controller === abort) {
      set({ ...result, controller: null })
    }
  }

  return {
    ...initialLocationSearchState,
    queryChanged: (text) => {
      cancel()
      const query = text.trim()
      if (query.length < minLocationQueryLength) {
        set(initialLocationSearchState)
        return
      }

      set({
        ...initialLocationSearchState,
        pause: setTimeout(() => void search(query), locationSearchPauseMs),
      })
    },
    reset: () => {
      cancel()
      set(initialLocationSearchState)
    },
  }
})
