# Login and Logout API Contract

All failures use the ASP.NET Core problem-details format (`application/problem+json`), as in `specs/001-user-registration/contracts/registration-api.md`. Messages have no display prefix; the frontend adds "Error: " (spec FR-008).

## Log In

```http
POST /api/auth/login
Content-Type: application/json
```

Request:

```json
{
  "email": "user@example.com",
  "password": "valid-password"
}
```

### Success

```http
200 OK
```

```json
{
  "email": "user@example.com",
  "role": "Registered User",
  "accountStatus": "Active"
}
```

The body is the same `CurrentUserResponse` as `GET /api/auth/me`. The response sets the sign-in cookie (HttpOnly, Secure, SameSite=Lax, non-persistent). A Suspended user also gets `200`, with `"accountStatus": "Suspended"`; the frontend sends them to the Account Suspended page (spec FR-010). The response never contains the password or its hash.

### Validation failure

```http
400 Bad Request
```

```json
{
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": {
    "email": ["Enter a valid email address."],
    "password": ["Enter your password."]
  }
}
```

Rules:

- The keys of `errors` are `email` and `password`. Every failing field is returned at once, one message per field.
- `email`: "Enter your email address." (empty after removing spaces around it), "Enter a valid email address." (invalid format or longer than 254 characters, the same rule as registration).
- `password`: "Enter your password." (empty). No length rule: an existing password is checked only against the account.
- Empty strings and missing fields both count as empty. A body that is not valid JSON returns `errors.request` = `["The request is invalid."]`.
- No account is looked up and no failed attempt is counted when validation fails.

### Incorrect email or password

```http
401 Unauthorized
```

```json
{
  "title": "Incorrect email or password.",
  "status": 401,
  "detail": "Incorrect email or password."
}
```

Returned when the email has no account, the password is wrong, or the account is locked (spec FR-004, FR-026). The three cases have the same status and body. No cookie is set.

### Already signed in

```http
403 Forbidden
```

```json
{
  "title": "Already signed in.",
  "status": 403,
  "detail": "You are already signed in."
}
```

The request is refused before any account lookup. The frontend opens `/` with no error message (spec FR-013).

### Technical failure

`500` problem details with the detail "Something went wrong. Try again.", or the central handler's generic `500`. For any `5xx`, a network error or the 10-second timeout, the frontend shows the FR-014 message with Retry and never shows the server's text.

## Log Out

```http
POST /api/auth/logout
```

No body.

```http
204 No Content
```

The response clears the sign-in cookie. It returns `204` whether or not the request had a valid session, so a user whose session already ended gets the same result (spec FR-017). A `5xx` or network failure leaves the frontend in the signed-in state and shows the FR-014 message with Retry.

## Current User (unchanged, from feature 001)

`GET /api/auth/me` returns `200` with `CurrentUserResponse` for any signed-in user, including a Suspended one, and `401` with no body otherwise.

## Authorization

| Endpoint | Visitor | Signed in (any role or status) |
| --- | --- | --- |
| `POST /api/auth/login` | Allowed | `403` |
| `POST /api/auth/logout` | `204` (no-op) | `204`, session ended |
| `GET /api/auth/me` | `401` | `200` |

Every row has an integration test. Lockout never changes `AccountStatus`.
