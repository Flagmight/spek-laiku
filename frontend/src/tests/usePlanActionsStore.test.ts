import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  deleteFailedMessage,
  deletingMessage,
  pendingMessage,
  planDeletedMessage,
  planGoneMessage,
  usePlanActionsStore,
} from "../stores/usePlanActionsStore"
import { jsonResponse, routeFetch } from "./renderApp"

const planId = "0b8f4c1e-7d2a-4f3b-9e6c-5a1d2c3b4e5f"
const deleteRoute = `DELETE /api/plans/${planId}`

function store() {
  return usePlanActionsStore.getState()
}

// Deleting a saved plan (feature 011 spec FR-001 to FR-003, research section 12).
describe("usePlanActionsStore: delete", () => {
  it("deletes the plan and shows 'Plan deleted.'", async () => {
    const { requests } = routeFetch({ [deleteRoute]: () => jsonResponse(204) })

    expect(await store().deletePlan(planId)).toBe("deleted")

    expect(store().notice).toBe(planDeletedMessage)
    expect(store().pending).toBeNull()
    expect(store().error).toBeNull()
    expect(requests).toHaveLength(1)
  })

  it("shows the pending text while the request runs", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [deleteRoute]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })

    const deleting = store().deletePlan(planId)

    expect(pendingMessage(store().pending)).toBe(deletingMessage)
    answer(jsonResponse(204))
    await deleting
    expect(pendingMessage(store().pending)).toBeNull()
  })

  it("sends no second request while the first is pending", async () => {
    let answer: (response: Response) => void = () => {}
    const { requests } = routeFetch({
      [deleteRoute]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })

    const first = store().deletePlan(planId)
    expect(await store().deletePlan(planId)).toBe("ignored")
    answer(jsonResponse(204))

    expect(await first).toBe("deleted")
    expect(requests).toHaveLength(1)
  })

  it("reports a plan that no longer exists", async () => {
    routeFetch({
      [deleteRoute]: () =>
        jsonResponse(404, { detail: "This plan no longer exists." }),
    })

    expect(await store().deletePlan(planId)).toBe("gone")

    expect(store().error).toEqual({
      kind: "delete",
      planId,
      message: planGoneMessage,
    })
    expect(store().notice).toBeNull()
  })

  it("reports a server error and deletes on retry", async () => {
    let calls = 0
    const { requests } = routeFetch({
      [deleteRoute]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(204),
    })

    expect(await store().deletePlan(planId)).toBe("failed")
    expect(store().error?.message).toBe(deleteFailedMessage)

    expect(await store().retry()).toBe("deleted")
    expect(store().error).toBeNull()
    expect(store().notice).toBe(planDeletedMessage)
    expect(requests).toHaveLength(2)
  })

  it("counts a request without an answer after 10 seconds as a failure", async () => {
    vi.useFakeTimers()
    try {
      routeFetch({ [deleteRoute]: () => new Promise<Response>(() => {}) })

      const deleting = store().deletePlan(planId)
      await vi.advanceTimersByTimeAsync(planRequestTimeoutMs)

      expect(await deleting).toBe("failed")
      expect(store().error?.message).toBe(deleteFailedMessage)
    } finally {
      vi.useRealTimers()
    }
  })

  it("refreshes the current user when the session ended", async () => {
    const refresh = vi
      .spyOn(useCurrentUserStore.getState(), "refresh")
      .mockResolvedValue()
    routeFetch({ [deleteRoute]: () => jsonResponse(401) })

    expect(await store().deletePlan(planId)).toBe("failed")

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(store().error?.message).toBe(deleteFailedMessage)
  })

  it("drops a late answer after reset", async () => {
    let answer: (response: Response) => void = () => {}
    routeFetch({
      [deleteRoute]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })

    const deleting = store().deletePlan(planId)
    store().reset()
    answer(jsonResponse(204))

    expect(await deleting).toBe("ignored")
    expect(store().notice).toBeNull()
  })
})
