import { create } from "zustand"
import { deleteAccount } from "../api/accountApi"
import { clearSignedInData } from "../helpers/clearSignedInData"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { startTimeout } from "../helpers/timedRequest"
import type { AccountDeletionAnswer } from "../types/accountDeletion"
import { useCurrentUserStore } from "./useCurrentUserStore"

export const deletingAccountMessage = "Deleting your account…"
export const deleteFailedMessage = formatErrorMessage(
  "Account could not be deleted. Try again.",
)
export const accountLockedMessage = formatErrorMessage(
  "Too many incorrect passwords. Try again in 15 minutes.",
)
// Shown next to the field by TextField, which adds "Error:".
export const enterPasswordMessage = "Enter your password."
export const passwordIncorrectMessage = "Password is incorrect."
// Shown on Home by SuccessBanner, which adds "✓ Success:".
export const accountDeletedMessage = "Your account has been deleted."

// How a submit ended: "refused" means the dialog stays open with a message next to the field or the lock message;
// "failed" that the request did not delete the account; "ignored" that a request was already running or the dialog
// was closed or reset.
export type AccountDeletionOutcome =
  "deleted" | "refused" | "failed" | "ignored"

// Deleting the signed-in user's own account from the Account page (feature 016 spec FR-002 to FR-008, FR-016,
// research sections 13 and 14). One request runs at a time, so a double press sends one. The password is kept only
// here, in memory, and is emptied when the dialog closes, after a wrong password or a lock, and on reset.
export interface AccountDeletionState {
  dialogOpen: boolean
  password: string
  status: "idle" | "pending" | "serverError"
  // A message for next to the field, without "Error:".
  fieldError: string | null
  // The lock or technical error for the dialog, with "Error:".
  error: string | null
  // Asks the dialog to focus the field; a new number for each request. The dialog clears it with focusHandled().
  focusRequest: number | null
  controller: AbortController | null
  open: () => void
  close: () => void
  setPassword: (password: string) => void
  submit: () => Promise<AccountDeletionOutcome>
  retry: () => Promise<AccountDeletionOutcome>
  focusHandled: () => void
  reset: () => void
}

export const initialAccountDeletionState: Pick<
  AccountDeletionState,
  | "dialogOpen"
  | "password"
  | "status"
  | "fieldError"
  | "error"
  | "focusRequest"
  | "controller"
> = {
  dialogOpen: false,
  password: "",
  status: "idle",
  fieldError: null,
  error: null,
  focusRequest: null,
  controller: null,
}

export const useAccountDeletionStore = create<AccountDeletionState>()((
  set,
  get,
) => {
  function focusField() {
    return (get().focusRequest ?? 0) + 1
  }

  function settle(
    answer: AccountDeletionAnswer | null,
  ): AccountDeletionOutcome {
    const done = { controller: null, status: "idle" as const }
    switch (answer?.kind) {
      case "deleted":
        // The session ended on purpose, as on log out (spec FR-004), and this store is reset with it.
        clearSignedInData()
        return "deleted"
      case "invalid":
        set({
          ...done,
          fieldError: answer.message,
          // A wrong password is emptied so the next attempt starts clean (spec FR-002).
          password:
            answer.message === passwordIncorrectMessage ? "" : get().password,
          focusRequest: focusField(),
        })
        return "refused"
      case "locked":
        set({
          ...done,
          error: accountLockedMessage,
          password: "",
          focusRequest: focusField(),
        })
        return "refused"
      case "signedOut":
        // SignedInOnly sends the user to Log in with "Your session has expired." (spec Edge Cases).
        set(initialAccountDeletionState)
        useCurrentUserStore.getState().markSessionEnded()
        return "failed"
      case "forbidden":
        // Suspended, or the account is already gone: the guards send the user on after the refresh. Repeating the
        // request would be refused again, so no Retry (research section 13).
        void useCurrentUserStore.getState().refresh()
        set({ ...done, error: deleteFailedMessage })
        return "failed"
      default:
        // A 5xx, a network error or the timeout: Retry sends the same password again (spec FR-008).
        set({
          controller: null,
          status: "serverError",
          error: deleteFailedMessage,
        })
        return "failed"
    }
  }

  return {
    ...initialAccountDeletionState,
    open: () => set({ ...initialAccountDeletionState, dialogOpen: true }),
    close: () => {
      // A request that may already have deleted the account cannot be cancelled (spec FR-007).
      if (get().status === "pending") {
        return
      }

      set(initialAccountDeletionState)
    },
    setPassword: (password) => set({ password, fieldError: null }),
    submit: async () => {
      // get() reads the current state, so a second press in the same render is still ignored.
      if (get().status === "pending") {
        return "ignored"
      }

      const { password } = get()
      if (password === "") {
        set({
          fieldError: enterPasswordMessage,
          error: null,
          focusRequest: focusField(),
        })
        return "refused"
      }

      const abort = new AbortController()
      set({
        status: "pending",
        fieldError: null,
        error: null,
        controller: abort,
      })
      const clearTimer = startTimeout(abort)
      let answer: AccountDeletionAnswer | null = null
      try {
        answer = await deleteAccount(password, abort.signal)
      } catch {
        // A 5xx, a network error, the timeout or an abort: answer stays null, which is a failure.
      } finally {
        clearTimer()
      }

      // After reset() the answer belongs to a closed page, so it is dropped.
      return get().controller === abort ? settle(answer) : "ignored"
    },
    retry: () => get().submit(),
    focusHandled: () => set({ focusRequest: null }),
    reset: () => {
      get().controller?.abort()
      set(initialAccountDeletionState)
    },
  }
})
