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

// The email search (feature 014 spec FR-002, FR-012, research section 12).
describe("useAdminAccountsStore: search", () => {
  it("trims the search and keeps it as the shown search", async () => {
    const { requests } = routeFetch({
      "GET /api/admin/accounts?search=ana": () =>
        jsonResponse(200, accountList([activeUser])),
    })

    await store().load("  ana  ")

    expect(requests[0]?.path).toBe("/api/admin/accounts?search=ana")
    expect(store().search).toBe("ana")
    expect(store().accounts).toEqual([activeUser])
  })

  it("shows only the latest search and aborts the one before it", async () => {
    let answerFirst: (response: Response) => void = () => {}
    const { fetchMock } = routeFetch({
      "GET /api/admin/accounts?search=a": () =>
        new Promise<Response>((resolve) => (answerFirst = resolve)),
      "GET /api/admin/accounts?search=bob": () =>
        jsonResponse(200, accountList([suspendedUser])),
    })

    const first = store().load("a")
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal
    await store().load("bob")
    answerFirst(jsonResponse(200, accountList([activeUser, suspendedUser])))
    await first

    expect(firstSignal?.aborted).toBe(true)
    expect(store().search).toBe("bob")
    expect(store().accounts).toEqual([suspendedUser])
    expect(store().status).toBe("loaded")
  })

  it("shows the server's refusal next to the field and keeps the list", async () => {
    const tooLong = "a".repeat(257)
    routeFetch({
      [listRoute]: () => jsonResponse(200, accountList([activeUser])),
      [`GET /api/admin/accounts?search=${tooLong}`]: () =>
        jsonResponse(400, {
          errors: { search: ["Search text can be at most 256 characters."] },
        }),
    })
    await store().load()

    await store().load(tooLong)

    expect(store().searchError).toBe(
      "Error: Search text can be at most 256 characters.",
    )
    expect(store().accounts).toEqual([activeUser])
    expect(store().status).toBe("loaded")
  })

  it("clears the refusal after a search that works", async () => {
    routeFetch({
      "GET /api/admin/accounts?search=x": () =>
        jsonResponse(400, {
          errors: { search: ["Search text can be at most 256 characters."] },
        }),
      "GET /api/admin/accounts?search=ana": () =>
        jsonResponse(200, accountList([activeUser])),
    })

    await store().load("x")
    await store().load("ana")

    expect(store().searchError).toBeNull()
  })
})
