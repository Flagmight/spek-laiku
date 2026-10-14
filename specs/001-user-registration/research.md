# Registration Research

## Decision

Use ASP.NET Core Identity for user creation, password hashing, normalized email uniqueness and password protection. Keep a persisted `AccountStatus` value so that active and suspended accounts can be distinguished.

The registration flow will create an `Active` Registered User. Email confirmation is out of scope for this feature (spec clarification session 2026-10-13), so no confirmation token is generated and no email is sent.

## Rationale

- The constitution requires ASP.NET Core Identity for authentication and user management.
- The specification requires case-insensitive duplicate detection, protected passwords, and an account status.
- Identity already provides password hashing and normalized email handling, avoiding custom password hashing or cryptography.
- The password rule is a minimum of 8 characters with no maximum, matching project requirement FR-045. Identity's password options are configured to match this rule.

## Alternatives Considered

### Custom password hashing

Rejected because the constitution forbids custom password hashing and Identity already provides it.

### Email confirmation before the account can be used

Rejected because email confirmation is out of scope for this feature (`docs/architecture.md` section 10). It would also need an email provider, token handling and an extra screen that no approved requirement asks for.

### CORS with credentials, or a token in browser storage

Rejected. CORS with credentials needs more configuration and widens the attack surface; a token in browser storage can be read by injected scripts. A same-origin cookie through the Vite proxy needs neither.

## Security Considerations

- Passwords must be hashed by Identity and never returned in API responses or written to logs.
- The duplicate-email check must rely on a unique index on the normalized email as the final guard against concurrent requests.
- Duplicate registration attempts reveal that the email is already registered, as the specification requires, and nothing more about the account.
- Error responses must not reveal stack traces or database details.

## Validation Strategy

- Backend unit tests will cover validation, duplicate handling, account creation as `Active`, and the already-signed-in refusal.
- Backend integration tests will use an isolated test database.
- Frontend tests will cover registration success, validation errors and server errors.
- The full backend build and tests plus frontend lint, tests, and build are required before completion.
