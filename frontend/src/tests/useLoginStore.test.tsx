import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { loginTimeoutMs, useLoginStore } from "../stores/useLoginStore"
import type { LoginState } from "../stores/useLoginStore"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, stubFetch } from "./renderApp"

const request = { email: "user@example.com", password: "  Password123!  " }

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

async function submit(result: { current: LoginState }) {
  await act(() => result.current.submit(request))
}

describe("useLoginStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("posts the request exactly as entered to /api/auth/login with same-origin credentials", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, signedInUser))
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    const [path, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(path).toBe("/api/auth/login")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")
    expect(JSON.parse(init.body as string)).toEqual(request)
  })

  it("is pending while the request is in progress", () => {
    stubHangingFetch()
    const { result } = renderHook(() => useLoginStore())

    act(() => {
      void result.current.submit(request)
    })

    expect(result.current.status).toBe("pending")
  })

  it("succeeds on 200, signs the user in and resolves with the user", async () => {
    stubFetch(() => jsonResponse(200, signedInUser))
    const setSignedIn = vi.spyOn(useCurrentUserStore.getState(), "setSignedIn")
    const { result } = renderHook(() => useLoginStore())

    let submitted: unknown
    await act(async () => {
      submitted = await result.current.submit(request)
    })

    expect(result.current.status).toBe("success")
    expect(submitted).toEqual({ status: "success", user: signedInUser })
    expect(setSignedIn).toHaveBeenCalledWith(signedInUser)
    expect(useCurrentUserStore.getState().status).toBe("signedIn")
    expect(useCurrentUserStore.getState().user).toEqual(signedInUser)
  })

  it("reports incorrect details on 401 and does not sign in", async () => {
    stubFetch(() =>
      jsonResponse(401, { detail: "Incorrect email or password." }),
    )
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    expect(result.current.status).toBe("incorrect")
    expect(useCurrentUserStore.getState().status).not.toBe("signedIn")
  })

  it("returns the first message for each field from a 400", async () => {
    stubFetch(() =>
      jsonResponse(400, {
        errors: {
          email: ["Enter your email address.", "Ignored."],
          password: ["Enter your password."],
        },
      }),
    )
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    expect(result.current.status).toBe("invalid")
    expect(result.current.errors).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    })
  })

  it("reports already signed in on 403", async () => {
    stubFetch(() => jsonResponse(403, { detail: "You are already signed in." }))
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    expect(result.current.status).toBe("alreadySignedIn")
  })

  it.each([500, 502, 503])("reports a server error on %i", async (status) => {
    stubFetch(() => jsonResponse(status, { detail: "Database is down." }))
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => useLoginStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useLoginStore())

    act(() => {
      void result.current.submit(request)
    })
    await act(() => vi.advanceTimersByTimeAsync(loginTimeoutMs - 1))
    expect(result.current.status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("serverError")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("ignores a second submit while a request is pending", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useLoginStore())

    let second: unknown = null
    await act(async () => {
      void result.current.submit(request)
      second = await result.current.submit(request)
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBeUndefined()
  })

  it("retry sends the last request again", async () => {
    let response = () => jsonResponse(500)
    const fetchMock = stubFetch(() => response())
    const { result } = renderHook(() => useLoginStore())
    await submit(result)
    expect(result.current.status).toBe("serverError")

    response = () => jsonResponse(200, signedInUser)
    await act(() => result.current.retry())

    expect(result.current.status).toBe("success")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodies = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string, RequestInit])[1].body,
    )
    expect(bodies[1]).toBe(bodies[0])
  })

  it("reset aborts a pending request, drops its result and starts idle", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useLoginStore())
    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.submit(request)
    })

    act(() => result.current.reset())

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.signal?.aborted).toBe(true)
    await act(async () => {
      expect(await pending).toBeUndefined()
    })
    expect(result.current.status).toBe("idle")
    expect(result.current.lastRequest).toBeNull()
  })

  it("reset drops a success that arrives after it, so nobody is signed in", async () => {
    let answer: (response: Response) => void = () => {}
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    )
    useCurrentUserStore.getState().setSignedOut()
    const { result } = renderHook(() => useLoginStore())
    let pending: Promise<unknown> = Promise.resolve()
    act(() => {
      pending = result.current.submit(request)
    })

    act(() => result.current.reset())
    answer(jsonResponse(200, signedInUser))
    await act(async () => {
      expect(await pending).toBeUndefined()
    })

    expect(result.current.status).toBe("idle")
    expect(useCurrentUserStore.getState().status).toBe("signedOut")
  })
})
