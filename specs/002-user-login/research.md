# Login and Logout Research

Technical decisions for feature 002. Each entry gives the decision, the reason and the alternatives that were rejected.

## 1. Checking the password and counting failed attempts

**Decision**: `LoginService` finds the account by normalized email with `UserManager.FindByEmailAsync` and checks the password with `SignInManager.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true)`. The controller then signs the user in with `SignInManager.SignInAsync(user, isPersistent: false)`, the same call registration uses.

**Rationale**: `CheckPasswordSignInAsync` uses Identity's password hasher, counts failed attempts, applies the lockout and resets the count after a successful login (spec FR-003, FR-026), with no custom password code (constitution IV). Keeping the check in the service and the cookie in the controller matches feature 001, where `RegistrationService` creates the account and `RegistrationController` signs in.

**Alternatives considered**:
- `SignInManager.PasswordSignInAsync`: checks and signs in in one call, but then the service sets a cookie, which is an HTTP concern, and the "already locked before this attempt" check needed for logging (section 3) is harder.
- Comparing hashes with `PasswordHasher` directly: rejected, it reimplements lockout counting.

## 2. Lockout settings

**Decision**: In `IdentityOptionsSetup.Configure` set `Lockout.MaxFailedAccessAttempts = 5`, `Lockout.DefaultLockoutTimeSpan = 15 minutes` and `Lockout.AllowedForNewUsers = true` (spec FR-026). A locked account gets the same `401` "Incorrect email or password." as a wrong password.

**Rationale**: These are Identity's built-in lockout options, shared with the tests through `IdentityOptionsSetup` as in feature 001. The `LockoutEnabled`, `LockoutEnd` and `AccessFailedCount` columns already exist in the `InitialIdentitySchema` migration, and accounts created by `UserManager.CreateAsync` already have `LockoutEnabled = true`, so **no migration is needed**.

**Notes**:
- An unknown email has no account to lock, so nothing is counted (spec Edge Cases).
- Identity resets the failed-attempt count when the lock starts, so after the lock ends the user again has 5 attempts.
- Tests make the lock end by setting `LockoutEnd` in the past in the test database, so no clock or time package is needed.

**Alternatives considered**: a custom failed-attempts table or rate limiter middleware. Rejected: more code, and the built-in feature matches the clarified rule exactly.

## 3. Logging (spec FR-027)

**Decision**: `LoginService` logs one `Warning` through `ILogger<LoginService>` when an attempt causes the lock, with the account's `Id` only: "Account {UserId} locked after repeated failed logins." The service checks `UserManager.IsLockedOutAsync` before the password check; when the account is already locked it returns the incorrect-credentials result at once and logs nothing, so the lock is logged once. Technical failures are logged by the existing `ApiExceptionHandler` (exception type only). Successful logins, failed logins and logouts write nothing.

**Rationale**: Matches the clarification (only lockouts and server failures) and NFR-006: no email or password in any log entry. `LoginRequest` masks its password in `PrintMembers`, like `RegistrationRequest`, because ASP.NET Core can log action arguments at Trace level.

## 4. Session lifetime (spec FR-019)

**Decision**: Keep the existing cookie settings from feature 001: `ExpireTimeSpan = 30 minutes`, `SlidingExpiration = true`.

**Rationale**: With sliding expiration the cookie is renewed when more than half of its 30 minutes have passed, so a session ends between 15 and 30 minutes after the last request, which is exactly the clarified rule. An integration test reads the configured `CookieAuthenticationOptions` and checks both values.

**Alternatives considered**: renewing the cookie on every request (custom `OnValidatePrincipal`). Rejected by the clarification; it adds a `Set-Cookie` header to every response.

## 5. Login and logout endpoints

**Decision**: Add `POST /api/auth/login` and `POST /api/auth/logout` to the existing `AuthController`. Login returns `200` with the existing `CurrentUserResponse` (email, role, account status), so the frontend can choose the destination without a second request. Wrong credentials and a locked account return `401` problem details. Logout always returns `204`, also when nobody is signed in (spec FR-017: an ended session gives the same result). Details are in `contracts/auth-api.md`.

**Rationale**: `AuthController` already owns `/api/auth/me`. Returning the user from login avoids a race between the login response and a follow-up `/me` call. `204` for an anonymous logout makes logout idempotent.

**Alternatives considered**: `400` with an `errors.credentials` key for wrong credentials. Rejected: `401` is the correct status, and the frontend shows the message at the top of the form, not next to one field.

## 6. Cross-site request forgery

**Decision**: No antiforgery tokens. The sign-in cookie is `SameSite=Lax` and both new endpoints are `POST` with a JSON body.

**Rationale**: Browsers do not send a `SameSite=Lax` cookie with a cross-site `POST`, and a cross-site form cannot send `application/json` without a CORS preflight, which the API never allows (no CORS policy). Login CSRF (forcing a victim to log in to the attacker's account) is also blocked, because `[ApiController]` rejects form-encoded bodies with `415`. This is the same reasoning feature 001 used for registration.

## 7. Shared email format rule (spec FR-002)

**Decision**: Move `IsValidEmailFormat` and `MaxEmailLength` from `RegistrationValidator` into a new static class `Services/EmailFormat.cs`, used by both `RegistrationValidator` and the new `LoginValidator`.

**Rationale**: Constitution I (DRY): the spec requires the same email rule for login as for registration.

## 8. Return-to page (spec FR-012, FR-020)

**Decision**: The Log in page reads the page to return to from the query string, `/login?returnTo=/plans`. A frontend helper `safeReturnTo` accepts a value only if it starts with a single `/`, does not start with `//` or `/\`, contains no `:` before the first `/` and is not `/login`, `/register` or `/account-suspended`. Anything else is ignored. The reason for being sent to log in ("Log in to continue." or "Your session has expired. Log in again.") is passed as router state.

**Rationale**: The backend never redirects (it returns JSON), so an open redirect could only happen in the frontend. Keeping `returnTo` in the address means it survives a page reload; the reason message does not need to.

## 9. Detecting an expired session (spec FR-020)

**Decision**: `useCurrentUserStore` gets a `sessionExpired` flag. A new route guard `signedInOnly.tsx` refreshes the current user when a protected route opens. If the store was `signedIn` and the refresh returns `signedOut`, the flag is set and the guard sends the user to `/login?returnTo=<path>` with the expired message; a visitor who was never signed in gets "Log in to continue." Logout sets the store to `signedOut` directly, so it is never treated as expiry. Later features whose API calls get `401` call the store's `markSessionEnded()` action.

**Rationale**: The server cannot tell an expired cookie from no cookie (the browser drops an expired cookie), so only the frontend knows the user was signed in before. No page needs login yet; the guard is tested with a test-only route.

## 10. Frontend state

**Decision**: Two new Zustand stores, following `useRegistrationStore`: `useLoginStore.ts` (status, field errors, submit, retry, reset, 10-second timeout, double-submit guard) and `useLogoutStore.ts` (status, submit, retry, timeout). `useCurrentUserStore` gains `setSignedIn(user)`, `setSignedOut()` and `markSessionEnded()`.

**Rationale**: Required by `AGENTS.md` and the constitution: shared and submission state live in Zustand stores, not React context. No new npm or NuGet packages are needed.
