# Data Model: 014-admin-accounts

**Date**: 2026-11-25 | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

This feature adds **no table, no column and no migration**. It reads and changes the existing `AspNetUsers` rows (features 001 and 002).

## Stored entity: User Account (`ApplicationUser`, table `AspNetUsers`)

| Field | Type | Used by this feature |
|---|---|---|
| `Id` | string (Identity key) | Read. It identifies the account in the API and in log entries. |
| `Email` | string, at most 256 characters | Read and returned. |
| `NormalizedEmail` | string, indexed | Read. The email search filters on it (research section 5). |
| `Role` | string: `"Registered User"` or `"Administrator"` | Read and returned. Only `"Registered User"` rows may change status. Never written. |
| `AccountStatus` | enum stored as a number: `0` = `Active`, `1` = `Suspended` | Read, returned and **written**. This is the only business field this feature changes. |
| `RegistrationDate` | timestamp (UTC) | Read and returned. Sorts the list, newest first. |
| `ConcurrencyStamp` | string | **Written** with a new value on every status change, so that an overlapping Identity update fails instead of writing the old status back (research section 3). Never returned. |
| `PasswordHash`, `SecurityStamp`, `LockoutEnd`, `AccessFailedCount` and the other Identity columns | — | Never read by the list query, never returned, never written (spec FR-010, FR-011). |

### Status transitions

```text
              Suspend (Registered User only, after confirmation)
   Active  ─────────────────────────────────────────────────────►  Suspended
           ◄─────────────────────────────────────────────────────
              Reactivate (Registered User only, no confirmation)
```

- **Repeats**: setting the status the account already has changes nothing and is not logged (spec FR-008).
- **Administrator accounts**: an Administrator account never changes status through this feature, whether it is Active or Suspended (spec FR-007).
- **Other data**: a status change never changes the email, password, role, registration date or saved plans (spec FR-010).

### Related entity: Saved Plan (`SavedPlans`, feature 010)

Not read or changed. A plan belongs to its account through `OwnerId` and stays unchanged through a suspension and reactivation (spec SC-005).

## API types (backend `DTOs/`)

| Type | Fields | Notes |
|---|---|---|
| `AdminAccountResponse` (new) | `Id`, `Email`, `Role`, `AccountStatus` (`"Active"` or `"Suspended"`), `RegistrationDate` (ISO 8601 UTC) | Exactly these five properties (research section 10). |
| `AdminAccountListResponse` (new) | `Accounts` (`AdminAccountResponse[]`, at most 50), `HasMore` (bool) | `HasMore` is true when more accounts match than are returned (spec FR-001). |
| `AccountStatusRequest` (new) | `AccountStatus` (string, nullable) | It must be `"Active"` or `"Suspended"`, exactly. Anything else gives 400 with `errors.accountStatus` "Select Active or Suspended.". |

## Service results (backend `Services/`)

- **`AdminAccountSummary`** (new record): `(string Id, string Email, string Role, AccountStatus AccountStatus, DateTime RegistrationDate)`. The list query projects each row to it, so only these five columns are read, and `AccountStatus` stays the enum until it is mapped in memory (no `ToString()` inside the database query).
- **`AdminAccountListing`** (new record): `(IReadOnlyList<AdminAccountSummary> Accounts, bool HasMore)`, returned by `ListAsync`. The controller maps it to `AdminAccountListResponse`.
- **`AdminAccountSearch`** (new, static): `Validate(string? search)` returns either the trimmed text, which may be empty, or the error "Search text can be at most 256 characters." (spec FR-002).
- **`AccountStatusChange`** (new record): the outcome of `SetStatusAsync`, where `account` is an `AdminAccountSummary`, as one of:
  - `Changed(account)`: the status was changed.
  - `Unchanged(account)`: the account already had that status.
  - `NotFound`.
  - `AdministratorAccount`.

  The controller maps it to 200, 200, 404 and 409 ([contracts](contracts/admin-accounts-api.md)).

## Frontend types and state (`frontend/src/`)

- **`types/adminAccount.ts`** (new):
  - `AdminAccount { id, email, role: "Registered User" | "Administrator", accountStatus: "Active" | "Suspended", registrationDate }`
  - `AdminAccountList { accounts, hasMore }`
- **`stores/useAdminAccountsStore.ts`** (new):
  - **State**:
    - `status`: `"idle" | "loading" | "loaded" | "error"`.
    - `accounts`, `hasMore`.
    - `search`: the text of the shown result.
    - `searchError`: the 256-character message, or `null`.
  - **Actions**:
    - `load(search)`: the latest request wins (research section 12).
    - `replace(account)`: updates one row after a change.
    - `reset()`: on leaving the page and on logout.
- **`stores/useAccountStatusStore.ts`** (new):
  - **State**:
    - `pending`: `{ accountId, change: "suspend" | "reactivate" } | null`.
    - `message`: the success text, the error text or `null`.
    - `failed`: the change to repeat on Retry.
  - **Actions**:
    - `change(account, target)`: ignored while one is pending.
    - `retry()`.
    - `clear()`.
  - **After an answer**:
    - **404 or 409**: shows the message and asks `useAdminAccountsStore` to load again.
    - **401 or 403**: refreshes the current user, so the guards redirect (as `usePlanActionsStore` does).
