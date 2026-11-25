import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import {
  accountGoneMessage,
  accountSuspendedMessage,
  administratorAccountMessage,
  statusMessage,
  suspendFailedMessage,
  suspendingMessage,
  useAccountStatusStore,
} from "../stores/useAccountStatusStore"
import { useAdminAccountsStore } from "../stores/useAdminAccountsStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  accountList,
  activeUser,
  suspendedUser,
  withStatus,
} from "./adminAccountsFixtures"
import { jsonResponse, routeFetch } from "./renderApp"

const listRoute = "GET /api/admin/accounts"
const suspendRoute = `PUT /api/admin/accounts/${activeUser.id}/status`

function store() {
  return useAccountStatusStore.getState()
}

async function loadList() {
  await useAdminAccountsStore.getState().load()
}

// Suspending an account (feature 014 spec FR-004, FR-006 to FR-008, FR-013).
describe("useAccountStatusStore: suspend", () => {
  it("suspends, replaces the row, shows the success text and asks for focus", async () => {
    const { requests } = routeFetch({
      [listRoute]: () => jsonResponse(200, accountList([activeUser])),
      [suspendRoute]: () =>
        jsonResponse(200, withStatus(activeUser, "Suspended")),
    })
    await loadList()

    await store().change(activeUser, "Suspended")

    expect(requests.at(-1)?.body).toEqual({ accountStatus: "Suspended" })
    expect(useAdminAccountsStore.getState().accounts).toEqual([
      withStatus(activeUser, "Suspended"),
    ])
    expect(statusMessage(store())).toBe(accountSuspendedMessage)
    expect(accountSuspendedMessage).toBe("✓ Success: Account suspended.")
    expect(store().focusRequest?.accountId).toBe(activeUser.id)
    expect(store().error).toBeNull()
  })

  it("shows the pending text and ignores a second change while one runs", async () => {
    let answer: (response: Response) => void = () => {}
    const { requests } = routeFetch({
      [suspendRoute]: () =>
        new Promise<Response>((resolve) => (answer = resolve)),
    })

    const first = store().change(activeUser, "Suspended")
    expect(statusMessage(store())).toBe(suspendingMessage)
    await store().change(suspendedUser, "Active")
    answer(jsonResponse(200, withStatus(activeUser, "Suspended")))
    await first

    expect(requests).toHaveLength(1)
  })

  it.each([
    [404, accountGoneMessage],
    [409, administratorAccountMessage],
  ])(
    "shows the message for %i without Retry and loads the list again",
    async (status, message) => {
      const { requests } = routeFetch({
        [listRoute]: () => jsonResponse(200, accountList([activeUser])),
        [suspendRoute]: () => jsonResponse(status, {}),
      })
      await loadList()

      await store().change(activeUser, "Suspended")
      await vi.waitFor(() =>
        expect(useAdminAccountsStore.getState().status).toBe("loaded"),
      )

      expect(store().error).toBe(message)
      expect(store().failed).toBeNull()
      expect(requests.filter((r) => r.method === "GET")).toHaveLength(2)
    },
  )

  it("shows the error with Retry for a server error, and Retry sends the same request", async () => {
    let fail = true
    const { requests } = routeFetch({
      [suspendRoute]: () =>
        fail
          ? jsonResponse(500, {})
          : jsonResponse(200, withStatus(activeUser, "Suspended")),
    })

    await store().change(activeUser, "Suspended")
    expect(store().error).toBe(suspendFailedMessage)
    expect(store().failed).toEqual({ account: activeUser, target: "Suspended" })

    fail = false
    await store().retry()

    expect(requests).toHaveLength(2)
    expect(requests[1]?.body).toEqual({ accountStatus: "Suspended" })
    expect(store().error).toBeNull()
    expect(statusMessage(store())).toBe(accountSuspendedMessage)
  })

  it("counts a change without an answer after 10 seconds as a failure", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [suspendRoute]: () => new Promise<Response>(() => {}) })

      const changing = store().change(activeUser, "Suspended")
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)
      await changing

      expect(store().error).toBe(suspendFailedMessage)
      expect(store().pending).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([401, 403])(
    "refreshes the current user when the change answers %i",
    async (status) => {
      const refresh = vi
        .spyOn(useCurrentUserStore.getState(), "refresh")
        .mockResolvedValue()
      routeFetch({ [suspendRoute]: () => jsonResponse(status, {}) })

      await store().change(activeUser, "Suspended")

      expect(refresh).toHaveBeenCalledTimes(1)
    },
  )

  it("drops a late answer after reset", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [suspendRoute]: () =>
        new Promise<Response>((resolve) => (answer = resolve)),
    })

    const changing = store().change(activeUser, "Suspended")
    store().reset()
    answer(jsonResponse(200, withStatus(activeUser, "Suspended")))
    await changing

    expect(store().notice).toBeNull()
    expect(store().focusRequest).toBeNull()
  })
})
