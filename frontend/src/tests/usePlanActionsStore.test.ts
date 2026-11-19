import { describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs } from "../helpers/timedRequest"
import { useCurrentUserStore } from "../stores/useCurrentUserStore"
import {
  deleteFailedMessage,
  deletingMessage,
  duplicateFailedMessage,
  duplicatingMessage,
  pendingMessage,
  planDeletedMessage,
  planDuplicatedMessage,
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

// Duplicating a saved plan (feature 011 spec FR-004 to FR-006, research section 12).
describe("usePlanActionsStore: duplicate", () => {
  const copyRoute = `POST /api/plans/${planId}/copies`
  const copy = {
    id: "5d2e9a7c-1b3f-4c8d-a6e2-9f0b1c2d3e4f",
    name: "Copy of Weekend in Kaunas",
    locationName: "Kaunas",
    dates: ["2026-11-21"],
    savedAt: "2026-11-18T12:05:00Z",
  }

  it("copies the plan, returns the copy and shows 'Plan duplicated.'", async () => {
    routeFetch({ [copyRoute]: () => jsonResponse(201, copy) })

    expect(await store().duplicatePlan(planId)).toEqual({ copy })

    expect(store().notice).toBe(planDuplicatedMessage)
  })

  it("shows its own pending text and sends one request for a double click", async () => {
    let answer: (response: Response) => void = () => {}
    const { requests } = routeFetch({
      [copyRoute]: () =>
        new Promise<Response>((resolve) => {
          answer = resolve
        }),
    })

    const first = store().duplicatePlan(planId)
    expect(pendingMessage(store().pending)).toBe(duplicatingMessage)
    expect(await store().duplicatePlan(planId)).toBe("ignored")
    answer(jsonResponse(201, copy))

    expect(await first).toEqual({ copy })
    expect(requests).toHaveLength(1)
  })

  it("reports a plan that no longer exists", async () => {
    routeFetch({ [copyRoute]: () => jsonResponse(404, {}) })

    expect(await store().duplicatePlan(planId)).toBe("gone")
    expect(store().error?.message).toBe(planGoneMessage)
  })

  it("reports a server error with its own message", async () => {
    routeFetch({ [copyRoute]: () => jsonResponse(500) })

    expect(await store().duplicatePlan(planId)).toBe("failed")
    expect(store().error).toEqual({
      kind: "duplicate",
      planId,
      message: duplicateFailedMessage,
    })
  })
})

// Retry repeats the action with the same result handler, so the page finishes the action however it succeeded.
describe("usePlanActionsStore: retry", () => {
  it("passes a delete that succeeds on retry to the same handler", async () => {
    let calls = 0
    routeFetch({
      [deleteRoute]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(204),
    })
    const onResult = vi.fn()

    await store().deletePlan(planId, onResult)
    await store().retry()

    expect(onResult.mock.calls).toEqual([["failed"], ["deleted"]])
  })

  it("passes a duplicate that succeeds on retry to the same handler", async () => {
    let calls = 0
    const copy = {
      id: "copy",
      name: "Copy of A",
      locationName: "Kaunas",
      dates: [],
      savedAt: "2026-11-18T12:05:00Z",
    }
    routeFetch({
      [`POST /api/plans/${planId}/copies`]: () =>
        ++calls === 1 ? jsonResponse(500) : jsonResponse(201, copy),
    })
    const onResult = vi.fn()

    await store().duplicatePlan(planId, onResult)
    await store().retry()

    expect(onResult.mock.calls).toEqual([["failed"], [{ copy }]])
  })
})
