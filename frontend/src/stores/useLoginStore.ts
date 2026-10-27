import { create } from "zustand"
import { login } from "../api/authApi"
import type { LoginOutcome } from "../api/authApi"
import type { CurrentUser } from "../types/currentUser"
import type { LoginFieldErrors, LoginRequest } from "../types/login"
import { useCurrentUserStore } from "./useCurrentUserStore"

// After this long without an answer the request counts as a server error (FR-014).
export const loginTimeoutMs = 10_000

export type LoginStatus =
  | "idle"
  | "pending"
  | "success"
  | "invalid"
  | "incorrect"
  | "serverError"
  | "alreadySignedIn"

// The final status, and on success the signed-in user, so the page can choose where to go.
export interface LoginSubmitResult {
  status: LoginStatus
  user: CurrentUser | null
}

interface LoginResult {
  status: LoginStatus
  errors: LoginFieldErrors
}

export interface LoginState extends LoginResult {
  lastRequest: LoginRequest | null
  controller: AbortController | null
  // Resolves with the result, or undefined when the submit was ignored or reset.
  submit: (request: LoginRequest) => Promise<LoginSubmitResult | undefined>
  retry: () => Promise<LoginSubmitResult | undefined>
  // Aborts a pending request and starts again from idle, for example when the page closes.
  reset: () => void
}

export const initialLoginState: Pick<
  LoginState,
  "status" | "errors" | "lastRequest" | "controller"
> = { status: "idle", errors: {}, lastRequest: null, controller: null }

function toResult(outcome: LoginOutcome): LoginResult {
  switch (outcome.kind) {
    case "signedIn":
      return { status: "success", errors: {} }
    case "invalid":
      return { status: "invalid", errors: outcome.errors }
    case "incorrect":
      return { status: "incorrect", errors: {} }
    case "alreadySignedIn":
      return { status: "alreadySignedIn", errors: {} }
  }
}

export const useLoginStore = create<LoginState>()((set, get) => ({
  ...initialLoginState,
  submit: async (request) => {
    // get() reads the current state, so a second click in the same render is still ignored.
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
    const timeout = setTimeout(() => abort.abort(), loginTimeoutMs)
    let outcome: LoginOutcome | null = null
    let result: LoginResult
    try {
      outcome = await login(request, abort.signal)
      result = toResult(outcome)
    } catch {
      // A 5xx, a network error or the timeout (FR-014). Technical details are never shown.
      result = { status: "serverError", errors: {} }
    } finally {
      clearTimeout(timeout)
    }

    // After reset() the request belongs to a closed page, so its result is dropped.
    if (get().controller !== abort) {
      return undefined
    }

    const user = outcome?.kind === "signedIn" ? outcome.user : null
    if (user) {
      useCurrentUserStore.getState().setSignedIn(user)
    }

    set({ ...result, controller: null })
    return { status: result.status, user }
  },
  retry: async () => {
    const { lastRequest, submit } = get()
    return lastRequest ? submit(lastRequest) : undefined
  },
  reset: () => {
    get().controller?.abort()
    set(initialLoginState)
  },
}))
