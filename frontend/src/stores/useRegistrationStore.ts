import { create } from "zustand"
import { register } from "../api/registrationApi"
import type { RegistrationOutcome } from "../api/registrationApi"
import type {
  RegistrationFieldErrors,
  RegistrationRequest,
} from "../types/registration"

// After this long without an answer the request counts as a server error (FR-018).
export const registrationTimeoutMs = 10_000

export type RegistrationStatus =
  "idle" | "pending" | "success" | "invalid" | "serverError" | "alreadySignedIn"

interface RegistrationResult {
  status: RegistrationStatus
  errors: RegistrationFieldErrors
}

export interface RegistrationState extends RegistrationResult {
  lastRequest: RegistrationRequest | null
  controller: AbortController | null
  // Resolves with the final status, or undefined when the submit was ignored.
  submit: (
    request: RegistrationRequest,
  ) => Promise<RegistrationStatus | undefined>
  retry: () => Promise<RegistrationStatus | undefined>
  // Aborts a pending request and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialRegistrationState: Pick<
  RegistrationState,
  "status" | "errors" | "lastRequest" | "controller"
> = { status: "idle", errors: {}, lastRequest: null, controller: null }

function toResult(outcome: RegistrationOutcome): RegistrationResult {
  switch (outcome.kind) {
    case "created":
      return { status: "success", errors: {} }
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "alreadySignedIn":
      return { status: "alreadySignedIn", errors: {} }
  }
}

export const useRegistrationStore = create<RegistrationState>()((set, get) => ({
  ...initialRegistrationState,
  submit: async (request) => {
    // get() reads the current state, so a second click in the same render is still ignored (FR-013).
    if (get().status === "pending") {
      return undefined
    }

    const abort = new AbortController()
    set({
      status: "pending",
      errors: {},
      lastRequest: request,
      controller: abort,
    })
    const timeout = setTimeout(() => abort.abort(), registrationTimeoutMs)
    let result: RegistrationResult
    try {
      result = toResult(await register(request, abort.signal))
    } catch {
      // A 5xx, a network error or the timeout (FR-015). Technical details are never shown.
      result = { status: "serverError", errors: {} }
    } finally {
      clearTimeout(timeout)
    }

    // After reset() the request belongs to a closed page, so its result is dropped.
    if (get().controller !== abort) {
      return undefined
    }

    set({ ...result, controller: null })
    return result.status
  },
  retry: async () => {
    const { lastRequest, submit } = get()
    return lastRequest ? submit(lastRequest) : undefined
  },
  reset: () => {
    get().controller?.abort()
    set(initialRegistrationState)
  },
}))
