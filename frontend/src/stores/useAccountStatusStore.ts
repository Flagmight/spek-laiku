import { create } from "zustand"
import { setAccountStatus } from "../api/adminAccountsApi"
import type { AccountStatusAnswer } from "../api/adminAccountsApi"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { startTimeout } from "../helpers/timedRequest"
import type { AccountStatus, AdminAccount } from "../types/adminAccount"
import { useAdminAccountsStore } from "./useAdminAccountsStore"
import { useCurrentUserStore } from "./useCurrentUserStore"

export const accountSuspendedMessage = "✓ Success: Account suspended."
export const accountReactivatedMessage = "✓ Success: Account reactivated."
export const suspendingMessage = "Suspending account…"
export const reactivatingMessage = "Reactivating account…"
export const suspendFailedMessage = formatErrorMessage(
  "Account could not be suspended. Try again.",
)
export const reactivateFailedMessage = formatErrorMessage(
  "Account could not be reactivated. Try again.",
)
export const accountGoneMessage = formatErrorMessage(
  "This account no longer exists.",
)
export const administratorAccountMessage = formatErrorMessage(
  "Administrator accounts cannot be suspended or reactivated here.",
)

export type AccountChangeKind = "suspend" | "reactivate"

export interface AccountChange {
  account: AdminAccount
  target: AccountStatus
}

const messages: Record<
  AccountChangeKind,
  { pending: string; done: string; failed: string }
> = {
  suspend: {
    pending: suspendingMessage,
    done: accountSuspendedMessage,
    failed: suspendFailedMessage,
  },
  reactivate: {
    pending: reactivatingMessage,
    done: accountReactivatedMessage,
    failed: reactivateFailedMessage,
  },
}

export function changeKind(target: AccountStatus): AccountChangeKind {
  return target === "Suspended" ? "suspend" : "reactivate"
}

// Suspending and reactivating an account on the User accounts page (feature 014 spec FR-004 to FR-008, FR-013). One
// change runs at a time, so a double press changes once. The pending and success texts go to the page's status region;
// an error goes to its alert region, with Retry only when repeating the same request can help.
export interface AccountStatusState {
  pending: { accountId: string; change: AccountChangeKind } | null
  notice: string | null
  error: string | null
  // The change Retry repeats; null when Retry is not offered.
  failed: AccountChange | null
  // Set after each successful change, so the page moves focus to the account's new button (spec FR-006).
  focusRequest: { accountId: string; sequence: number } | null
  controller: AbortController | null
  change: (account: AdminAccount, target: AccountStatus) => Promise<void>
  retry: () => Promise<void>
  reset: () => void
}

export const initialAccountStatusState: Pick<
  AccountStatusState,
  "pending" | "notice" | "error" | "failed" | "focusRequest" | "controller"
> = {
  pending: null,
  notice: null,
  error: null,
  failed: null,
  focusRequest: null,
  controller: null,
}

// The pending text, else the notice, for the page's status region.
export function statusMessage(
  state: Pick<AccountStatusState, "pending" | "notice">,
): string | null {
  return state.pending ? messages[state.pending.change].pending : state.notice
}

export const useAccountStatusStore = create<AccountStatusState>()((
  set,
  get,
) => {
  function settle(change: AccountChange, answer: AccountStatusAnswer | null) {
    const kind = changeKind(change.target)
    const done = { pending: null, controller: null }
    if (answer?.kind === "changed") {
      useAdminAccountsStore.getState().replace(answer.account)
      set({
        ...done,
        notice: messages[kind].done,
        focusRequest: {
          accountId: answer.account.id,
          sequence: (get().focusRequest?.sequence ?? 0) + 1,
        },
      })
      return
    }

    if (answer?.kind === "gone" || answer?.kind === "administrator") {
      // The list no longer matches the server, so it is loaded again with the same search (spec Edge Cases).
      set({
        ...done,
        error:
          answer.kind === "gone"
            ? accountGoneMessage
            : administratorAccountMessage,
      })
      const accounts = useAdminAccountsStore.getState()
      void accounts.load(accounts.search)
      return
    }

    if (answer) {
      // The session ended or the account changed: the guards send the user on after the refresh.
      void useCurrentUserStore.getState().refresh()
    }
    set({ ...done, error: messages[kind].failed, failed: change })
  }

  return {
    ...initialAccountStatusState,
    change: async (account, target) => {
      if (get().pending) {
        return
      }

      const change = { account, target }
      const abort = new AbortController()
      set({
        pending: { accountId: account.id, change: changeKind(target) },
        notice: null,
        error: null,
        failed: null,
        controller: abort,
      })
      const clearTimer = startTimeout(abort)
      let answer: AccountStatusAnswer | null = null
      try {
        answer = await setAccountStatus(account.id, target, abort.signal)
      } catch {
        // A 5xx, a network error, the timeout or an abort: answer stays null, which is a failure.
      } finally {
        clearTimer()
      }

      // After reset() the answer belongs to a closed page, so it is dropped.
      if (get().controller === abort) {
        settle(change, answer)
      }
    },
    retry: () => {
      const { failed } = get()
      return failed
        ? get().change(failed.account, failed.target)
        : Promise.resolve()
    },
    reset: () => {
      get().controller?.abort()
      set(initialAccountStatusState)
    },
  }
})
