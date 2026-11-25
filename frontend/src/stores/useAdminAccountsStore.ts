import { create } from "zustand"
import { listAccounts } from "../api/adminAccountsApi"
import type { AccountListAnswer } from "../api/adminAccountsApi"
import { ApiError } from "../api/apiClient"
import { formatErrorMessage } from "../helpers/formatErrorMessage"
import { startTimeout } from "../helpers/timedRequest"
import type { AdminAccount } from "../types/adminAccount"
import { useCurrentUserStore } from "./useCurrentUserStore"

export const loadingAccountsMessage = "Loading accounts…"
export const accountsLoadFailedMessage = formatErrorMessage(
  "Accounts could not be loaded.",
)

// The User accounts list and its search (feature 014 spec FR-001, FR-002, FR-012, research section 12). Each load
// aborts the one before it, so only the answer to the latest search is shown.
export interface AdminAccountsState {
  status: "idle" | "loading" | "loaded" | "error"
  accounts: AdminAccount[]
  hasMore: boolean
  // The search of the list shown, and of the latest request, which Retry repeats.
  search: string
  requestedSearch: string
  // The server's refusal of the latest search, next to the field; the list shown before it is kept.
  searchError: string | null
  controller: AbortController | null
  load: (search?: string) => Promise<void>
  // Puts the answer to a status change in place of the account's row.
  replace: (account: AdminAccount) => void
  reset: () => void
}

export const initialAdminAccountsState: Pick<
  AdminAccountsState,
  | "status"
  | "accounts"
  | "hasMore"
  | "search"
  | "requestedSearch"
  | "searchError"
  | "controller"
> = {
  status: "idle",
  accounts: [],
  hasMore: false,
  search: "",
  requestedSearch: "",
  searchError: null,
  controller: null,
}

export const useAdminAccountsStore = create<AdminAccountsState>()(
  (set, get) => ({
    ...initialAdminAccountsState,
    load: async (search = "") => {
      const requested = search.trim()
      get().controller?.abort()
      const abort = new AbortController()
      set({ status: "loading", requestedSearch: requested, controller: abort })
      const clearTimer = startTimeout(abort)
      let answer: AccountListAnswer | null = null
      let refused = false
      try {
        answer = await listAccounts(requested, abort.signal)
      } catch (error) {
        // A 5xx, a network error or the timeout. Technical details are never shown.
        refused =
          error instanceof ApiError &&
          (error.status === 401 || error.status === 403)
      } finally {
        clearTimer()
      }

      // A later load or reset() has taken over, so this answer is dropped.
      if (get().controller !== abort) {
        return
      }

      if (refused) {
        // The session ended or the account changed: the guards send the user on after the refresh.
        void useCurrentUserStore.getState().refresh()
      }

      if (answer?.kind === "loaded") {
        set({
          status: "loaded",
          accounts: answer.list.accounts,
          hasMore: answer.list.hasMore,
          search: requested,
          searchError: null,
          controller: null,
        })
      } else if (answer?.kind === "invalidSearch") {
        // The list shown before the search stays, with the message next to the field (spec Edge Cases).
        set({
          status: "loaded",
          searchError: formatErrorMessage(answer.message),
          controller: null,
        })
      } else {
        set({ status: "error", controller: null })
      }
    },
    replace: (account) =>
      set({
        accounts: get().accounts.map((shown) =>
          shown.id === account.id ? account : shown,
        ),
      }),
    reset: () => {
      get().controller?.abort()
      set(initialAdminAccountsState)
    },
  }),
)
