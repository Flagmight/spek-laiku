import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import { jsonResponse, stubFetch } from "./renderApp"

const signedInUser = {
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
})
