import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import {
  accountLockedMessage,
  deleteFailedMessage,
  enterPasswordMessage,
  initialAccountDeletionState,
  passwordIncorrectMessage,
  useAccountDeletionStore,
} from "../stores/useAccountDeletionStore"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  initialPlanSetupState,
  usePlanSetupStore,
} from "../stores/usePlanSetupStore"
import { jsonResponse, routeFetch, signedInUser } from "./renderApp"

const route = "POST /api/account/delete"
const password = "Password123!"

function store() {
  return useAccountDeletionStore.getState()
}

function openWithPassword(value = password) {
  store().open()
  store().setPassword(value)
}

describe("useAccountDeletionStore: dialog", () => {
  it("opens with an empty field and no messages", () => {
    useAccountDeletionStore.setState({ error: deleteFailedMessage })

    store().open()

    expect(store()).toMatchObject({
      ...initialAccountDeletionState,
      dialogOpen: true,
    })
  })

  it("empties the password when the dialog closes", () => {
    openWithPassword()

    store().close()

    expect(store()).toMatchObject(initialAccountDeletionState)
  })

  it("does not close while the request is pending", async () => {
    routeFetch({ [route]: () => new Promise<Response>(() => {}) })
    openWithPassword()
    void store().submit()

    store().close()

    expect(store().dialogOpen).toBe(true)
    expect(store().status).toBe("pending")
  })

  it("clears the field message when the password changes", () => {
    store().open()
    useAccountDeletionStore.setState({ fieldError: enterPasswordMessage })

    store().setPassword("a")

    expect(store().fieldError).toBeNull()
  })
})

// Deleting the account (feature 016 spec FR-002 to FR-008, FR-016, research section 13).
describe("useAccountDeletionStore: submit", () => {
  it("refuses an empty password without a request and asks for focus", async () => {
    const { requests } = routeFetch({})
    store().open()

    await expect(store().submit()).resolves.toBe("refused")

    expect(requests).toHaveLength(0)
    expect(store().fieldError).toBe(enterPasswordMessage)
    expect(store().focusRequest).not.toBeNull()
  })

  it("sends a password of only spaces exactly as entered", async () => {
    const { requests } = routeFetch({ [route]: () => jsonResponse(204) })
    openWithPassword("   ")

    await store().submit()

    expect(requests[0]?.body).toEqual({ password: "   " })
  })

  it("is pending while the request runs and ignores a second submit", async () => {
    let answer: (response: Response) => void = () => {}
    const { requests } = routeFetch({
      [route]: () => new Promise<Response>((resolve) => (answer = resolve)),
    })
    openWithPassword()

    const first = store().submit()
    const second = await store().submit()

    expect(second).toBe("ignored")
    expect(store().status).toBe("pending")
    expect(requests).toHaveLength(1)
    answer(jsonResponse(204))
    await expect(first).resolves.toBe("deleted")
  })

  it("clears the session data and itself after a deletion", async () => {
    routeFetch({ [route]: () => jsonResponse(204) })
    useCurrentUserStore.getState().setSignedIn(signedInUser())
    usePlanSetupStore.getState().setLocationText("Kaunas")
    openWithPassword()

    await expect(store().submit()).resolves.toBe("deleted")

    expect(useCurrentUserStore.getState()).toMatchObject({
      status: "signedOut",
      sessionExpired: false,
    })
    expect(usePlanSetupStore.getState()).toMatchObject(initialPlanSetupState)
    expect(store()).toMatchObject(initialAccountDeletionState)
  })

  it("empties the field and asks for focus after a wrong password", async () => {
    routeFetch({
      [route]: () =>
        jsonResponse(400, {
          errors: { password: [passwordIncorrectMessage] },
        }),
    })
    openWithPassword("wrong")

    await expect(store().submit()).resolves.toBe("refused")

    expect(store()).toMatchObject({
      dialogOpen: true,
      status: "idle",
      password: "",
      fieldError: passwordIncorrectMessage,
      error: null,
    })
    expect(store().focusRequest).not.toBeNull()
  })

  it("shows the lock message, empties the field and offers no Retry", async () => {
    routeFetch({ [route]: () => jsonResponse(429, {}) })
    openWithPassword()

    await expect(store().submit()).resolves.toBe("refused")

    expect(accountLockedMessage).toBe(
      "Error: Too many incorrect passwords. Try again in 15 minutes.",
    )
    expect(store()).toMatchObject({
      dialogOpen: true,
      status: "idle",
      password: "",
      error: accountLockedMessage,
    })
    expect(store().focusRequest).not.toBeNull()
  })

  it("marks the session ended on 401", async () => {
    const markSessionEnded = vi.spyOn(
      useCurrentUserStore.getState(),
      "markSessionEnded",
    )
    routeFetch({ [route]: () => jsonResponse(401) })
    openWithPassword()

    await expect(store().submit()).resolves.toBe("failed")

    expect(markSessionEnded).toHaveBeenCalledTimes(1)
    expect(store()).toMatchObject(initialAccountDeletionState)
  })

  it("refreshes the current user on 403 and offers no Retry", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [route]: () => jsonResponse(403) })
    openWithPassword()

    await expect(store().submit()).resolves.toBe("failed")

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(store().status).toBe("idle")
    expect(store().error).toBe(deleteFailedMessage)
  })

  it.each([
    ["a server error", () => jsonResponse(500, {})],
    ["a network error", () => Promise.reject(new TypeError("offline"))],
  ])("offers Retry after %s and keeps the password", async (_, answer) => {
    routeFetch({ [route]: answer })
    openWithPassword()

    await expect(store().submit()).resolves.toBe("failed")

    expect(deleteFailedMessage).toBe(
      "Error: Account could not be deleted. Try again.",
    )
    expect(store()).toMatchObject({
      status: "serverError",
      error: deleteFailedMessage,
      password,
    })
  })

  it("counts no answer after 10 seconds as a server error", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [route]: () => new Promise<Response>(() => {}) })
      openWithPassword()

      const deleting = store().submit()
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs - 1)
      expect(store().status).toBe("pending")
      await vi.advanceTimersByTimeAsync(1)

      await expect(deleting).resolves.toBe("failed")
      expect(store().status).toBe("serverError")
    } finally {
      vi.useRealTimers()
    }
  })

  it("sends the same password again on Retry", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [route]: () =>
        ++calls === 1 ? jsonResponse(500, {}) : jsonResponse(204),
    })
    openWithPassword()
    await store().submit()

    await expect(store().retry()).resolves.toBe("deleted")

    expect(requests.map((request) => request.body)).toEqual([
      { password },
      { password },
    ])
  })

  it("aborts a pending request on reset and drops its answer", async () => {
    routeFetch({ [route]: () => new Promise<Response>(() => {}) })
    openWithPassword()
    const deleting = store().submit()

    store().reset()

    await expect(deleting).resolves.toBe("ignored")
    expect(store()).toMatchObject(initialAccountDeletionState)
  })
})
