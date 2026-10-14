import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it } from "vitest"
import { CurrentUserProvider } from "../components/currentUserProvider"
import { useCurrentUser } from "../hooks/useCurrentUser"
import { jsonResponse, stubFetch } from "./renderApp"

const signedInUser = {
  email: "user@example.com",
  role: "Registered User",
  accountStatus: "Active",
}

function wrapper({ children }: { children: ReactNode }) {
  return <CurrentUserProvider>{children}</CurrentUserProvider>
}

describe("useCurrentUser", () => {
  it("reads the signed-in user from /api/auth/me with same-origin credentials", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, signedInUser))

    const { result } = renderHook(useCurrentUser, { wrapper })

    expect(result.current.status).toBe("loading")
    await waitFor(() => expect(result.current.status).toBe("signedIn"))
    expect(result.current.user).toEqual(signedInUser)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/me",
      expect.objectContaining({ credentials: "same-origin" }),
    )
  })

  it("is signed out when the API returns 401", async () => {
    stubFetch(() => jsonResponse(401))

    const { result } = renderHook(useCurrentUser, { wrapper })

    await waitFor(() => expect(result.current.status).toBe("signedOut"))
    expect(result.current.user).toBeNull()
  })

  it("reports an error when the API fails", async () => {
    stubFetch(() => jsonResponse(500))

    const { result } = renderHook(useCurrentUser, { wrapper })

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.user).toBeNull()
  })

  it("refresh picks up a new sign-in", async () => {
    let response = () => jsonResponse(401)
    stubFetch(() => response())
    const { result } = renderHook(useCurrentUser, { wrapper })
    await waitFor(() => expect(result.current.status).toBe("signedOut"))

    response = () => jsonResponse(200, signedInUser)
    await act(() => result.current.refresh())

    expect(result.current.status).toBe("signedIn")
    expect(result.current.user).toEqual(signedInUser)
  })
})
