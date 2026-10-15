# Registration API Contract

## Register Account

```http
POST /api/registration
Content-Type: application/json
```

Request:

```json
{
  "email": "visitor@example.com",
  "password": "valid-password",
  "passwordConfirmation": "valid-password"
}
```

Success response:

```http
201 Created
```

```json
{
  "success": true,
  "message": "Account created.",
  "accountStatus": "Active"
}
```

On success the response also sets the sign-in cookie, so the new user is signed in (spec FR-008). The frontend then navigates to the home page (`/`) and shows the banner "✓ Success: Account created.".

The response must never include the password or password hash.

## Registration Failure

All failures use the ASP.NET Core problem-details format (`application/problem+json`) that the central error handling already produces.

### Validation failure and duplicate email

```http
400 Bad Request
Content-Type: application/problem+json
```

```json
{
  "type": "https://tools.ietf.org/html/rfc9110#section-15.5.1",
  "title": "One or more request fields are invalid.",
  "status": 400,
  "errors": {
    "email": ["Enter a valid email address."],
    "passwordConfirmation": ["Passwords do not match."]
  }
}
```

Rules:

- The keys of `errors` are the request field names: `email`, `password` and `passwordConfirmation`.
- Every failing field is returned in one response, with exactly one message per field, so the page can show all of them at once (spec FR-010, SC-002).
- The message for each field is the first one that applies, in this order:
  - `email`: "Enter your email address." (empty), "Enter a valid email address." (invalid format or longer than 254 characters).
  - `password`: "Enter a password." (empty), "Password must be at least 8 characters." No maximum length is enforced.
  - `passwordConfirmation`: "Confirm your password." (empty), "Passwords do not match."
- The duplicate check runs only when all three fields are otherwise valid. A duplicate returns `errors.email` = `["This email is already registered."]`. This includes the case where two requests for the same email arrive at the same time and either Identity's uniqueness check or the database unique index rejects the second one.
- Empty strings and missing fields both count as empty and get the messages above, not a generic model-binding error. A body that is not valid JSON returns `400` with `errors.request` = `["The request is invalid."]`.

### Technical failure

```http
500 Internal Server Error
Content-Type: application/problem+json
```

```json
{
  "title": "Something went wrong.",
  "status": 500,
  "detail": "Something went wrong. Try again."
}
```

No partial account remains. An unexpected exception handled by the central handler also returns `500`, with its own generic text. For **any** `5xx` response, a network error or the FR-018 timeout, the frontend shows the FR-015 message with a Retry button that sends the same request again, and never shows the server's text or technical details.

Messages in this contract have no display prefix. The frontend adds the prefix required by spec FR-019 when it shows a message.

### Already signed in

```http
403 Forbidden
Content-Type: application/problem+json
```

```json
{
  "title": "Already signed in.",
  "status": 403,
  "detail": "You are already signed in."
}
```

No account is created. The frontend navigates to `/` and shows no error message (spec FR-014).

## Current User

```http
GET /api/auth/me
```

Signed in:

```http
200 OK
```

```json
{
  "email": "visitor@example.com",
  "role": "Registered User",
  "accountStatus": "Active"
}
```

Any signed-in user gets `200`, including a Suspended user, whose `accountStatus` is `"Suspended"`. Blocking suspended users is handled by feature 014.

Not signed in: `401 Unauthorized` with no body. The frontend uses this endpoint to decide whether the visitor is signed in (spec FR-014 and US1 scenario 2). Feature 002 reuses it.

## Authorization

`POST /api/registration` refuses signed-in users (`403`). `GET /api/auth/me` requires a signed-in user (`401` otherwise). No endpoint in this feature checks account status; that is added by the first feature that needs it. Authorization is enforced on the backend and never relies on frontend visibility.
