import { useCallback, useEffect, useRef, useState } from "react"
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

interface RegistrationState {
  status: RegistrationStatus
  errors: RegistrationFieldErrors
}

function toState(outcome: RegistrationOutcome): RegistrationState {
  switch (outcome.kind) {
    case "created":
      return { status: "success", errors: {} }
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "alreadySignedIn":
      return { status: "alreadySignedIn", errors: {} }
  }
}

export function useRegistration() {
  const [state, setState] = useState<RegistrationState>({
    status: "idle",
    errors: {},
  })
  // Refs, not state, so a second click in the same render is still ignored (FR-013).
  const pending = useRef(false)
  const lastRequest = useRef<RegistrationRequest | null>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const submit = useCallback(async (request: RegistrationRequest) => {
    if (pending.current) {
      return
    }

    pending.current = true
    lastRequest.current = request
    setState({ status: "pending", errors: {} })
    const abort = new AbortController()
    controller.current = abort
    const timeout = setTimeout(() => abort.abort(), registrationTimeoutMs)
    try {
      setState(toState(await register(request, abort.signal)))
    } catch {
      // A 5xx, a network error or the timeout (FR-015). Technical details are never shown.
      setState({ status: "serverError", errors: {} })
    } finally {
      clearTimeout(timeout)
      pending.current = false
    }
  }, [])

  const retry = useCallback(async () => {
    if (lastRequest.current) {
      await submit(lastRequest.current)
    }
  }, [submit])

  return { ...state, submit, retry }
}
