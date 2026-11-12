import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { planRequestTimeoutMs, startTimeout } from "../helpers/timedRequest"

describe("startTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("waits 10 seconds", () => {
    expect(planRequestTimeoutMs).toBe(10_000)
  })

  it("aborts the request after 10 seconds without an answer", () => {
    const controller = new AbortController()
    startTimeout(controller)

    vi.advanceTimersByTime(planRequestTimeoutMs - 1)
    expect(controller.signal.aborted).toBe(false)

    vi.advanceTimersByTime(1)
    expect(controller.signal.aborted).toBe(true)
  })

  it("does not abort a request whose timer was cleared earlier", () => {
    const controller = new AbortController()
    const clear = startTimeout(controller)

    vi.advanceTimersByTime(planRequestTimeoutMs - 1)
    clear()
    vi.advanceTimersByTime(planRequestTimeoutMs)

    expect(controller.signal.aborted).toBe(false)
  })
})
