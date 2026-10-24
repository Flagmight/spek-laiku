import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  registrationTimeoutMs,
  useRegistrationStore,
} from "../stores/useRegistrationStore"
import type { RegistrationState } from "../stores/useRegistrationStore"
import { jsonResponse, stubFetch } from "./renderApp"

const request = {
  email: "user@example.com",
  password: "  Password123!  ",
  passwordConfirmation: "  Password123!  ",
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

async function submit(result: { current: RegistrationState }, body = request) {
  await act(() => result.current.submit(body))
}

describe("useRegistrationStore", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("starts idle with no errors", () => {
    const { result } = renderHook(() => useRegistrationStore())

    expect(result.current.status).toBe("idle")
    expect(result.current.errors).toEqual({})
  })

  it("posts the request exactly as entered to /api/registration with same-origin credentials", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(201, { success: true, message: "Account created." }),
    )
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [path, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(path).toBe("/api/registration")
    expect(init.method).toBe("POST")
    expect(init.credentials).toBe("same-origin")
    expect(new Headers(init.headers).get("Content-Type")).toBe(
      "application/json",
    )
    expect(JSON.parse(init.body as string)).toEqual(request)
  })

  it("is pending while the request is in progress", () => {
    stubHangingFetch()
    const { result } = renderHook(() => useRegistrationStore())

    act(() => {
      void result.current.submit(request)
    })

    expect(result.current.status).toBe("pending")
  })

  it("succeeds on 201", async () => {
    stubFetch(() => jsonResponse(201, { success: true }))
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("success")
    expect(result.current.errors).toEqual({})
  })

  it("returns the first message for each field from a 400", async () => {
    stubFetch(() =>
      jsonResponse(400, {
        title: "One or more request fields are invalid.",
        errors: {
          email: ["This email is already registered."],
          passwordConfirmation: ["Passwords do not match.", "Ignored."],
        },
      }),
    )
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("invalid")
    expect(result.current.errors).toEqual({
      email: "This email is already registered.",
      passwordConfirmation: "Passwords do not match.",
    })
  })

  it("treats a 400 without field errors as a server error", async () => {
    stubFetch(() =>
      jsonResponse(400, { errors: { request: ["The request is invalid."] } }),
    )
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
    expect(result.current.errors).toEqual({})
  })

  it("reports already signed in on 403", async () => {
    stubFetch(() => jsonResponse(403, { detail: "You are already signed in." }))
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("alreadySignedIn")
  })

  it.each([500, 502, 503])("reports a server error on %i", async (status) => {
    stubFetch(() => jsonResponse(status, { detail: "Database is down." }))
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error when the network fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    )
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)

    expect(result.current.status).toBe("serverError")
  })

  it("reports a server error after 10 seconds without an answer, not before", async () => {
    vi.useFakeTimers()
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useRegistrationStore())

    act(() => {
      void result.current.submit(request)
    })
    await act(() => vi.advanceTimersByTimeAsync(registrationTimeoutMs - 1))
    expect(result.current.status).toBe("pending")

    await act(() => vi.advanceTimersByTimeAsync(1))

    expect(result.current.status).toBe("serverError")
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.signal?.aborted).toBe(true)
  })

  it("ignores a second submit while a request is pending", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useRegistrationStore())

    act(() => {
      void result.current.submit(request)
      void result.current.submit(request)
    })
    await act(() => result.current.submit(request))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("allows a new submit after the request has finished", async () => {
    const fetchMock = stubFetch(() => jsonResponse(500))
    const { result } = renderHook(() => useRegistrationStore())

    await submit(result)
    await submit(result)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retry sends the last request again", async () => {
    let response = () => jsonResponse(500)
    const fetchMock = stubFetch(() => response())
    const { result } = renderHook(() => useRegistrationStore())
    await submit(result)
    expect(result.current.status).toBe("serverError")

    response = () => jsonResponse(201, { success: true })
    await act(() => result.current.retry())

    expect(result.current.status).toBe("success")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const bodies = fetchMock.mock.calls.map(
      (call) => (call as unknown as [string, RequestInit])[1].body,
    )
    expect(bodies[1]).toBe(bodies[0])
  })

  it("resolves submit with the final status, or undefined when ignored", async () => {
    stubFetch(() =>
      jsonResponse(400, { errors: { password: ["Enter a password."] } }),
    )
    const { result } = renderHook(() => useRegistrationStore())

    let first: Promise<unknown> = Promise.resolve()
    let second: Promise<unknown> = Promise.resolve()
    act(() => {
      first = result.current.submit(request)
      second = result.current.submit(request)
    })

    await act(async () => {
      expect(await first).toBe("invalid")
      expect(await second).toBeUndefined()
    })
  })

  it("retry does nothing before the first submit", async () => {
    const fetchMock = stubFetch(() => jsonResponse(201))
    const { result } = renderHook(() => useRegistrationStore())

    await act(() => result.current.retry())

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.status).toBe("idle")
  })

  it("reset aborts a pending request, drops its result and starts idle", async () => {
    const fetchMock = stubHangingFetch()
    const { result } = renderHook(() => useRegistrationStore())
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
    expect(result.current.errors).toEqual({})
  })

  it("reset forgets the last request, so retry does nothing", async () => {
    const fetchMock = stubFetch(() => jsonResponse(500))
    const { result } = renderHook(() => useRegistrationStore())
    await submit(result)

    act(() => result.current.reset())
    await act(() => result.current.retry())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current.status).toBe("idle")
  })
})
