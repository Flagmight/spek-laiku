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
  // Where focus goes next: the account's new button after a successful change (spec FR-006), or the page heading
  // (accountId null) when the list is loaded again after a 404 or 409, because the button is gone. The page or
  // the list clears it with focusHandled() once used, so a list shown again later does not take focus.
  focusRequest: { accountId: string | null; sequence: number } | null
  controller: AbortController | null
  change: (
    account: AdminAccount,
    target: AccountStatus,
  ) => Promise<AccountChangeOutcome>
  retry: () => Promise<AccountChangeOutcome>
  focusHandled: () => void
  reset: () => void
}

// How a change ended: "reloaded" means the account was gone or an Administrator account and the list is loaded
// again; "ignored" that another change was running or the page closed.
export type AccountChangeOutcome = "changed" | "reloaded" | "failed" | "ignored"

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
  function focusOn(accountId: string | null) {
    return { accountId, sequence: (get().focusRequest?.sequence ?? 0) + 1 }
  }

  // Loads the list again with the search the administrator asked for last, which may still be loading.
  function reloadList() {
    const accounts = useAdminAccountsStore.getState()
    void accounts.load(accounts.requestedSearch)
  }

  function settle(
    change: AccountChange,
    answer: AccountStatusAnswer | null,
  ): AccountChangeOutcome {
    const kind = changeKind(change.target)
    const done = { pending: null, controller: null }
    if (answer?.kind === "changed") {
      const accounts = useAdminAccountsStore.getState()
      accounts.replace(answer.account)
      // A list answer still on its way may have been read before this change, so it is asked for again.
      if (accounts.status === "loading") {
        reloadList()
      }
      set({
        ...done,
        notice: messages[kind].done,
        focusRequest: focusOn(answer.account.id),
      })
      return "changed"
    }

    if (answer?.kind === "gone" || answer?.kind === "administrator") {
      // The list no longer matches the server, so it is loaded again with the same search (spec Edge Cases).
      set({
        ...done,
        error:
          answer.kind === "gone"
            ? accountGoneMessage
            : administratorAccountMessage,
        focusRequest: focusOn(null),
      })
      reloadList()
      return "reloaded"
    }

    if (answer) {
      // The session ended or the account changed: the guards send the user on after the refresh. Repeating the
      // same request would be refused again, so no Retry.
      void useCurrentUserStore.getState().refresh()
      set({ ...done, error: messages[kind].failed })
      return "failed"
    }

    set({ ...done, error: messages[kind].failed, failed: change })
    return "failed"
  }

  return {
    ...initialAccountStatusState,
    change: async (account, target) => {
      if (get().pending) {
        return "ignored"
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
      return get().controller === abort ? settle(change, answer) : "ignored"
    },
    retry: () => {
      const { failed } = get()
      return failed
        ? get().change(failed.account, failed.target)
        : Promise.resolve("ignored")
    },
    focusHandled: () => set({ focusRequest: null }),
    reset: () => {
      get().controller?.abort()
      set(initialAccountStatusState)
    },
  }
})
