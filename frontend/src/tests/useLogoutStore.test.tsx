import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { useKeptScheduleStore } from "../stores/useKeptScheduleStore"
import { logoutTimeoutMs, useLogoutStore } from "../stores/useLogoutStore"
import { usePlanEditStore } from "../stores/usePlanEditStore"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, stubFetch } from "./renderApp"

const signedInUser: CurrentUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

// A request that only ends when it is aborted, like a server that never answers.
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

function expectStillSignedIn() {
  expect(useCurrentUserStore.getState().status).toBe("signedIn")
  expect(useCurrentUserStore.getState().user).toEqual(signedInUser)
}

describe("useLogoutStore", () => {
  beforeEach(() => {
    useCurrentUserStore.getState().setSignedIn(signedInUser)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("is pending while the request is in progress", () => {
    stubHangingFetch()
    const { result } = renderHook(() => useLogoutStore())

    act(() => {
      void result.current.submit()
    })

    expect(result.current.status).toBe("pending")
  })

  it("posts to /api/auth/logout and on 204 signs out, returns to idle and resolves true", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }))
    const setSignedOut = vi.spyOn(
      useCurrentUserStore.getState(),
      "setSignedOut",
    )
    const { result } = renderHook(() => useLogoutStore())

    let submitted: unknown
    await act(async () => {
      submitted = await result.current.submit()
    })

    const [path, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(path).toBe("/api/auth/logout")
    expect(init.method).toBe("POST")
    expect(submitted).toBe(true)
    expect(setSignedOut).toHaveBeenCalled()
    expect(result.current.status).toBe("idle")
    expect(useCurrentUserStore.getState().status).toBe("signedOut")
    // Logging out is not an expired session (FR-020).
    expect(useCurrentUserStore.getState().sessionExpired).toBe(false)
  })

  it("clears a schedule kept for saving after login (feature 010 spec FR-007)", async () => {
    stubFetch(() => new Response(null, { status: 204 }))
    useKeptScheduleStore.setState({
      kept: {
        key: "plan",
        schedule: {
          generatedScheduleId: null,
          scheduled: [],
          unscheduled: [],
          travel: { maxDistanceKm: 30, tripsOverLimit: 0 },
        },
      },
    })
    const { result } = renderHook(() => useLogoutStore())

    await act(async () => {
      await result.current.submit()
    })

    expect(useKeptScheduleStore.getState().kept).toBeNull()
  })

  it("clears an edit and the saved marker (feature 011 spec FR-013)", async () => {
    stubFetch(() => new Response(null, { status: 204 }))
    usePlanEditStore.setState({
      edit: {
        planId: "plan-1",
        planName: "Weekend in Kaunas",
        ownerEmail: signedInUser.email,
      },
      savedPlanKey: "saved",
    })
    const { result } = renderHook(() => useLogoutStore())

    await act(async () => {
      await result.current.submit()
    })

    expect(usePlanEditStore.getState().edit).toBeNull()
    expect(usePlanEditStore.getState().savedPlanKey).toBeNull()
  })

  it("ignores a second submit while a request is pending", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useLogoutStore())

    let second: unknown = null
    await act(async () => {
      void result.current.submit()
      second = await result.current.submit()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(false)
  })

  it.each([500, 502, 503])(
    "reports a server error on %i and keeps the user signed in",
    async (status) => {
      stubFetch(() => jsonResponse(status))
      const { result } = renderHook(() => useLogoutStore())

      await act(() => result.current.submit())

      expect(result.current.status).toBe("serverError")
      expectStillSignedIn()
    },
  )

  it("reports a server error when the network fails and keeps the user signed in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => useLogoutStore())

    await act(() => result.current.submit())

    expect(result.current.status).toBe("serverError")
    expectStillSignedIn()
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useLogoutStore())

    act(() => {
      void result.current.submit()
    })
    await act(() => vi.advanceTimersByTimeAsync(logoutTimeoutMs - 1))
    expect(result.current.status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("serverError")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
    expectStillSignedIn()
  })

  it("retry sends the request again", async () => {
    let response = () => jsonResponse(500)
    const fetchMock = stubFetch(() => response())
    const { result } = renderHook(() => useLogoutStore())
    await act(() => result.current.submit())
    expect(result.current.status).toBe("serverError")

    response = () => new Response(null, { status: 204 })
    await act(() => result.current.retry())

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe("idle")
    expect(useCurrentUserStore.getState().status).toBe("signedOut")
    expect(useCurrentUserStore.getState().sessionExpired).toBe(false)
  })
})
