import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import type { CurrentUser } from "../types/currentUser"
import { jsonResponse, stubFetch } from "./renderApp"

const signedInUser: CurrentUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

function renderStore() {
  return renderHook(() => useCurrentUserStore())
}

describe("useCurrentUserStore", () => {
  it("reads the signed-in user from /api/auth/me with same-origin credentials", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, signedInUser))
    const { result } = renderStore()

    expect(result.current.status).toBe("loading")
    await act(() => result.current.refresh())

    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    )
  })

  it("is signed out when the API returns 401", async () => {
    stubFetch(() => jsonResponse(401))
    const { result } = renderStore()

    await act(() => result.current.refresh())

    expect(result.current.status).toBe("signedOut")
    expect(result.current.user).toBeNull()
  })

  it("reports an error when the API fails", async () => {
    stubFetch(() => jsonResponse(500))
    const { result } = renderStore()

    await act(() => result.current.refresh())

    expect(result.current.status).toBe("error")
    expect(result.current.user).toBeNull()
  })

  it("refresh picks up a new sign-in", async () => {
    let response = () => jsonResponse(401)
    stubFetch(() => response())
    const { result } = renderStore()
    await act(() => result.current.refresh())
    expect(result.current.status).toBe("signedOut")

    response = () => jsonResponse(200, signedInUser)
    await act(() => result.current.refresh())

    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
  })

  it("only the most recent request updates the state", async () => {
    const answers: ((response: Response) => void)[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => answers.push(resolve))),
    )
    const { result } = renderStore()
    let first: Promise<void> = Promise.resolve()
    let second: Promise<void> = Promise.resolve()
    act(() => {
      first = result.current.refresh()
      second = result.current.refresh()
    })

    // The newer request answers first; the older, slower answer must not replace it.
    answers[1](jsonResponse(200, signedInUser))
    await act(() => second)
    answers[0](jsonResponse(401))
    await act(() => first)

    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
  })

  it("setSignedIn and setSignedOut set the expected state", () => {
    const { result } = renderStore()

    act(() => result.current.setSignedIn(signedInUser))
    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
    expect(result.current.sessionExpired).toBe(false)

    act(() => result.current.setSignedOut())
    expect(result.current.status).toBe("signedOut")
    expect(result.current.user).toBeNull()
    expect(result.current.sessionExpired).toBe(false)
  })

  it("markSessionEnded marks the session expired only when signed in", () => {
    const { result } = renderStore()

    act(() => result.current.setSignedOut())
    act(() => result.current.markSessionEnded())
    expect(result.current.status).toBe("signedOut")
    expect(result.current.sessionExpired).toBe(false)

    act(() => result.current.setSignedIn(signedInUser))
    act(() => result.current.markSessionEnded())
    expect(result.current.status).toBe("signedOut")
    expect(result.current.user).toBeNull()
    expect(result.current.sessionExpired).toBe(true)
  })

  it("refresh returning 401 after being signed in marks the session expired", async () => {
    stubFetch(() => jsonResponse(401))
    const { result } = renderStore()
    act(() => result.current.setSignedIn(signedInUser))

    await act(() => result.current.refresh())

    expect(result.current.status).toBe("signedOut")
    expect(result.current.sessionExpired).toBe(true)
  })

  it("refresh returning 401 when never signed in does not mark the session expired", async () => {
    stubFetch(() => jsonResponse(401))
    const { result } = renderStore()

    await act(() => result.current.refresh())

    expect(result.current.sessionExpired).toBe(false)
  })

  it("setSignedOut never marks the session expired", () => {
    const { result } = renderStore()
    act(() => result.current.setSignedIn(signedInUser))

    act(() => result.current.setSignedOut())

    expect(result.current.sessionExpired).toBe(false)
  })

  it("an action called while a refresh is pending is not overwritten by that refresh", async () => {
    let answer: (response: Response) => void = () => {}
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((resolve) => (answer = resolve))),
    )
    const { result } = renderStore()
    let pending: Promise<void> = Promise.resolve()
    act(() => {
      pending = result.current.refresh()
    })

    act(() => result.current.setSignedIn(signedInUser))
    answer(jsonResponse(401))
    await act(() => pending)

    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
    expect(result.current.sessionExpired).toBe(false)
  })
})
