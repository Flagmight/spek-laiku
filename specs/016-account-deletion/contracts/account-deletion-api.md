# API Contract: Account Deletion (016)

One new endpoint. All other endpoints are unchanged; the ones listed at the end are only re-tested for a deleted account.

## `POST /api/account/delete`

Deletes the signed-in user's own account and all their saved plans, and signs them out (spec FR-002 to FR-009, FR-016).

**Authorization**: policy `ActiveRegisteredUser` (a signed-in Registered User whose account is Active, read from the database on every request). The request never names an account.

**Request body** (`application/json`):

```json
{ "password": "the account's current password" }
```

| Field | Rules |
|---|---|
| `password` | Required, not empty. Used exactly as entered: never trimmed. No length rule. |

**Answers**

| Status | When | Body |
|---|---|---|
| `204 No Content` | The password was correct and the account and its plans were deleted. The answer also removes the session cookie (`Set-Cookie` with an expiry in the past). | None. |
| `400 Bad Request` | `password` missing or empty. Nothing is counted. | `ValidationProblemDetails`, `errors.password: ["Enter your password."]` |
| `400 Bad Request` | The password is wrong. One failed attempt is counted towards the login lock. | `ValidationProblemDetails`, `errors.password: ["Password is incorrect."]` |
| `400 Bad Request` | The body is missing or is not valid JSON. | `ValidationProblemDetails`, `errors.request: ["The request is invalid."]` (the existing `InvalidModelStateResponseFactory`). |
| `401 Unauthorized` | Not signed in. | None. |
| `403 Forbidden` | Signed in, but not an Active Registered User: an Administrator, a Suspended account, a session whose account no longer exists, or an account suspended or changed after the request started. Nothing is deleted and no attempt is counted. | None (the authorization result) or `ProblemDetails` without account data (the conditional delete). |
| `429 Too Many Requests` | The account is locked for login (5 failed attempts in a row, in the dialog or on Log in), including the attempt that locks it. Even the correct password is refused. | `ProblemDetails`, `title` and `detail`: "Too many incorrect passwords. Try again in 15 minutes." |
| `500 Internal Server Error` | Unexpected failure. Nothing is deleted (one transaction). | `ProblemDetails` from `ApiExceptionHandler`, no technical details. |

**Order of checks**: authorization, then the body, then the lock and the password, then the conditional delete. A refused caller never reaches the password check.

**Side effects on 204**:

- The `AspNetUsers` row and every `SavedPlans` row with that `OwnerId` are gone, together with the account's Identity claim, login, role and token rows.
- One Information log entry: `Account {UserId} deleted with {PlanCount} saved plans.` No email, no password.

**Side effects on the attempt that locks the account**: one Warning log entry with the account id, as on Log in.

## Existing endpoints re-tested for a deleted account

A client that still holds the deleted account's cookie (another browser) gets:

| Request | Answer |
|---|---|
| `GET /api/auth/me` | `401`, no body. |
| `GET /api/plans`, `GET /api/plans/{id}` of the deleted plans | `403` (`ActiveRegisteredUser` re-reads the account). |
| `POST /api/account/delete` | `403`. |
| `POST /api/auth/login` with the old email and password | `401` "Incorrect email or password." |
| `POST /api/registration` with the same email | `201`, a new account with no plans. |

## Browser API module (`frontend/src/api/accountApi.ts`)

`deleteAccount(password: string, signal: AbortSignal): Promise<AccountDeletionAnswer>`

| HTTP | `AccountDeletionAnswer` |
|---|---|
| 204 | `{ kind: "deleted" }` |
| 400 with `errors.password` | `{ kind: "invalid", message }`: the first message, without "Error:". |
| 429 | `{ kind: "locked" }` |
| 401 | `{ kind: "signedOut" }` |
| 403 | `{ kind: "forbidden" }` |
| anything else | throws `ApiError(status)` |

A network error or an abort rejects, as with `fetch`.
