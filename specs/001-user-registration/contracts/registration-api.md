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
  "message": "Account created. Verify your email to continue.",
  "accountStatus": "PendingVerification"
}
```

The response must never include the password, password hash, confirmation token, or verification link.

## Verify Email

```http
GET /api/registration/verify?userId={id}&token={token}
```

The endpoint returns a success or failure result. A successful response changes the account status to `Active` and sets `EmailConfirmed` to `true`.

Invalid, expired, reused, or malformed tokens return a generic failure without revealing the account state.

## Registration Failure

Validation failures return field-level messages. Duplicate emails return the specified duplicate-email message. Technical failures return the generic account-creation message and must not leave a partial account.

## Authorization Contract

Protected endpoints must reject an unauthenticated user or a user whose `AccountStatus` is not `Active`. The authorization policy must not rely on frontend visibility.
