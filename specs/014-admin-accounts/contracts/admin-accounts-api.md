# API Contract: Administrator account endpoints

**Feature**: 014-admin-accounts | **Date**: 2026-11-25 | **Data model**: [../data-model.md](../data-model.md)

Both endpoints are on `AdminAccountsController` (`/api/admin/accounts`) under the existing `ActiveAdministrator` policy. They use the same session cookie, JSON bodies (camelCase) and problem bodies as `/api/admin/categories` (feature 003).

## Authorization (both endpoints)

| Caller | Answer | Body |
|---|---|---|
| Visitor (no session) | 401 | empty |
| Active Registered User | 403 | problem body, no account data |
| Suspended Registered User | 403 | problem body, no account data |
| Suspended Administrator | 403 | problem body, no account data |
| Active Administrator | as below | |

The policy is checked before the query string or body is read, so a refused caller never learns whether an account exists.

## `GET /api/admin/accounts`

Lists accounts, newest registration first (`RegistrationDate` descending, then `Id`), at most 50.

**Query**: `search` (optional). It is trimmed. When it is not empty, only accounts whose email contains it, ignoring letter case, are listed. `%` and `_` are matched literally.

**200 OK**:

```json
{
  "accounts": [
    {
      "id": "8d3f0c2e-6a1b-4f7e-9c55-1b2a3c4d5e6f",
      "email": "ana@example.com",
      "role": "Registered User",
      "accountStatus": "Active",
      "registrationDate": "2026-11-21T12:05:00Z"
    },
    {
      "id": "3b9a7d10-2c4e-4f61-8a0e-0d1c2b3a4f5e",
      "email": "admin@example.com",
      "role": "Administrator",
      "accountStatus": "Active",
      "registrationDate": "2026-10-05T08:00:00Z"
    }
  ],
  "hasMore": false
}
```

- Each account has exactly these five properties. There is no password, hash, stamp, lockout or plan field.
- `hasMore` is `true` when more than 50 accounts match.
- No match gives `"accounts": []` and `"hasMore": false`.

**400 Bad Request**: `search` is longer than 256 characters after trimming.

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": { "search": ["Search text can be at most 256 characters."] }
}
```

## `PUT /api/admin/accounts/{id}/status`

Sets one account's status. `{id}` is the account's `id` from the list.

**Body**:

```json
{ "accountStatus": "Suspended" }
```

`accountStatus` must be exactly `"Suspended"` or `"Active"`.

**200 OK**: the account after the request, with the same shape as one list item. This is also the answer when the account already had that status, in which case nothing was changed or logged.

```json
{
  "id": "8d3f0c2e-6a1b-4f7e-9c55-1b2a3c4d5e6f",
  "email": "ana@example.com",
  "role": "Registered User",
  "accountStatus": "Suspended",
  "registrationDate": "2026-11-21T12:05:00Z"
}
```

**400 Bad Request**: `accountStatus` is missing or not one of the two values.

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": { "accountStatus": ["Select Active or Suspended."] }
}
```

**404 Not Found**: no account has this id.

```json
{ "title": "Not found.", "status": 404, "detail": "This account no longer exists." }
```

**409 Conflict**: the account is an Administrator account, including the caller's own. Nothing is changed.

```json
{
  "title": "Administrator account.",
  "status": 409,
  "detail": "Administrator accounts cannot be suspended or reactivated here."
}
```

**Order of checks**:
1. The policy (401 or 403).
2. The body (400).
3. That the account exists (404).
4. That it is a Registered User account (409).
5. The change.

The role check and the change are one database statement (research section 3).

## Effects on other endpoints

There is no contract change. A suspended user's next request to any endpoint under `PlanCreator`, `ActiveRegisteredUser` or `ActiveAdministrator` gives 403, and `GET /api/auth/me` returns `"accountStatus": "Suspended"`. After reactivation, the same requests succeed again (research section 4).

## Log entries

On a change, not on a repeat, at Information level:

- `Account {AccountId} suspended by administrator {AdministratorId}.`
- `Account {AccountId} reactivated by administrator {AdministratorId}.`

No email is logged. Technical failures are logged by `ApiExceptionHandler` and answered with 500.
