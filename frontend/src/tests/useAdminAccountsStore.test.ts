import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import {
  accountsLoadFailedMessage,
  useAdminAccountsStore,
} from "../stores/useAdminAccountsStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  accountList,
  activeUser,
  suspendedUser,
  withStatus,
} from "./adminAccountsFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/admin/accounts"

function store() {
  return useAdminAccountsStore.getState()
}

// The User accounts list (feature 014 spec FR-001, FR-012, research section 12).
describe("useAdminAccountsStore: load", () => {
  it("is loading while the request runs, then loaded", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [listRoute]: () => new Promise<Response>((resolve) => (answer = resolve)),
    })

    const loading = store().load()
    expect(store().status).toBe("loading")
    answer(jsonResponse(200, accountList([activeUser], true)))
    await loading

    expect(store().status).toBe("loaded")
    expect(store().accounts).toEqual([activeUser])
    expect(store().hasMore).toBe(true)
  })

  it("shows the error state for a server error, and loads again on Retry", async () => {
    let fail = true
    routeFetch({
      [listRoute]: () =>
        fail ? jsonResponse(500, {}) : jsonResponse(200, accountList()),
    })

    await store().load()
    expect(store().status).toBe("error")
    expect(accountsLoadFailedMessage).toBe(
      "Error: Accounts could not be loaded.",
    )

    fail = false
    await store().load(store().requestedSearch)
    expect(store().status).toBe("loaded")
  })

  it("counts a request without an answer after 10 seconds as an error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [listRoute]: () => new Promise<Response>(() => {}) })

      const loading = store().load()
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await loading

      expect(store().status).toBe("error")
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([401, 403])(
    "refreshes the current user when the list answers %i",
    async (status) => {
      const refresh = vi
        .spyOn(useCurrentUserStore.getState(), "refresh")
        .mockResolvedValue()
      routeFetch({ [listRoute]: () => jsonResponse(status, {}) })

      await store().load()

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(store().status).toBe("error")
    },
  )

  it("replaces one row with the answer to a change", async () => {
    routeFetch({
      [listRoute]: () =>
        jsonResponse(200, accountList([activeUser, suspendedUser])),
    })
    await store().load()

    store().replace(withStatus(activeUser, "Suspended"))

    expect(store().accounts).toEqual([
      withStatus(activeUser, "Suspended"),
      suspendedUser,
    ])
  })

  it("drops a late answer after reset", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [listRoute]: () => new Promise<Response>((resolve) => (answer = resolve)),
    })

    const loading = store().load()
    store().reset()
    answer(jsonResponse(200, accountList()))
    await loading

    expect(store().status).toBe("idle")
    expect(store().accounts).toEqual([])
  })
})
