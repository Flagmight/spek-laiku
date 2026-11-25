import type {
  AccountStatus,
  AdminAccount,
  AdminAccountList,
} from "../types/adminAccount"
import { ApiError, apiFetch } from "./apiClient"

const basePath = "/api/admin/accounts"

export type AccountListAnswer =
  | { kind: "loaded"; list: AdminAccountList }
  | { kind: "invalidSearch"; message: string }

export type AccountStatusAnswer =
  | { kind: "changed"; account: AdminAccount }
  | { kind: "gone" }
  | { kind: "administrator" }
  | { kind: "sessionEnded" }
  | { kind: "forbidden" }

interface ValidationProblem {
  errors?: Record<string, string[] | undefined>
}

// The accounts whose email contains the search, newest first, at most 50 (feature 014 contracts/admin-accounts-api.md).
// An empty search sends no query string. A search the server refuses (400) is an answer; 401, 403 and any other status
// throw ApiError with that status. Network and abort errors pass through.
export async function listAccounts(
  search: string,
  signal?: AbortSignal,
): Promise<AccountListAnswer> {
  const query = search ? `?search=${encodeURIComponent(search)}` : ""
  const response = await apiFetch(`${basePath}${query}`, { signal })
  if (response.status === 200) {
    return { kind: "loaded", list: (await response.json()) as AdminAccountList }
  }

  if (response.status === 400) {
    const problem = (await response.json()) as ValidationProblem
    const message = problem.errors?.search?.[0]
    if (message) {
      return { kind: "invalidSearch", message }
    }
  }

  throw new ApiError(response.status)
}

// Sets one account's status. Each expected status maps to an answer; anything else throws ApiError. Network and abort
// errors pass through.
export async function setAccountStatus(
  id: string,
  accountStatus: AccountStatus,
  signal?: AbortSignal,
): Promise<AccountStatusAnswer> {
  const response = await apiFetch(
    `${basePath}/${encodeURIComponent(id)}/status`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountStatus }),
      signal,
    },
  )
  switch (response.status) {
    case 200:
      return {
        kind: "changed",
        account: (await response.json()) as AdminAccount,
      }
    case 401:
      return { kind: "sessionEnded" }
    case 403:
      return { kind: "forbidden" }
    case 404:
      return { kind: "gone" }
    case 409:
      return { kind: "administrator" }
    default:
      throw new ApiError(response.status)
  }
}
