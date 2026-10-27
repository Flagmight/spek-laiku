# Implementation Plan: 002-user-login

**Branch**: `002-user-login` | **Date**: 2026-10-26 | **Spec**: [specs/002-user-login/spec.md](spec.md)

**Input**: Feature specification from `/specs/002-user-login/spec.md`

## Summary

Add login and logout on top of the account and sign-in cookie from feature 001. The backend gets `POST /api/auth/login` and `POST /api/auth/logout` on the existing `AuthController`, a `LoginService` that checks the password with ASP.NET Core Identity and applies Identity's built-in lockout (5 attempts, 15 minutes), and a shared email format rule. The frontend gets a Log in page, an Account Suspended page, Log in / Log out navigation, a route guard for pages that need login (with "return to" and session-expiry messages) and two Zustand stores. No database change and no new package.

## Technical Context

**Language/Version**: C# on .NET 10 (ASP.NET Core Web API); TypeScript with React 19, built with Vite. Unchanged from feature 001.

**Primary Dependencies**: Existing only. Backend: ASP.NET Core Identity (`UserManager`, `SignInManager`), EF Core with Npgsql, AutoMapper. Frontend: React, React Router, Zustand. Tests: xUnit, `Microsoft.AspNetCore.Mvc.Testing`, Testcontainers PostgreSQL, Vitest, React Testing Library. **No new NuGet or npm package.**

**Authentication**: The Identity application cookie from feature 001 (HttpOnly, Secure, SameSite=Lax, 30-minute sliding expiration). `LoginService` uses `SignInManager.CheckPasswordSignInAsync(..., lockoutOnFailure: true)`; `AuthController` signs in with `SignInManager.SignInAsync(user, isPersistent: false)` and signs out with `SignInManager.SignOutAsync()`. Sliding expiration renews the cookie after half its lifetime, which gives the clarified 15 to 30 minute session (spec FR-019; research section 4).

**Lockout**: `IdentityOptionsSetup.Configure` sets `Lockout.MaxFailedAccessAttempts = 5`, `Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15)` and `Lockout.AllowedForNewUsers = true`. A locked account gets the same `401` as a wrong password. `LoginService` checks `IsLockedOutAsync` before the password check, so the lock is logged once, by account id, when it starts (FR-026, FR-027; research sections 2 and 3).

**Backend structure**:
- `Services/EmailFormat.cs` (new): `MaxLength` and `IsValid`, moved out of `RegistrationValidator`, which now calls it.
- `Services/LoginValidator.cs` (new): field messages for `email` and `password`.
- `Services/LoginService.cs` (new): validate, find by email, lockout check, password check, logging. Returns `LoginResult` (`Services/LoginResult.cs`, new): `Success(user)`, `Invalid(errors)`, `IncorrectCredentials()`.
- `DTOs/Requests/LoginRequest.cs` (new): nullable `Email`, `Password`; `PrintMembers` masks the password.
- `Controllers/AuthController.cs`: adds `Login` (`[AllowAnonymous]`, `403` when already signed in) and `Logout` (`[AllowAnonymous]`, always `204`). The response is the existing `CurrentUserResponse` through the existing `CurrentUserMappingProfile`.
- `Program.cs`: registers `LoginService`.

**Error responses**: Problem details as in feature 001. `400` with `errors.email` / `errors.password`; `401` "Incorrect email or password." for unknown email, wrong password or locked account; `403` when already signed in; `500` for technical failures. API messages have no prefix; the frontend adds "Error: ". Details in `contracts/auth-api.md`.

**Frontend structure**:
- `api/authApi.ts`: adds `login(request, signal)` returning `{ kind: "signedIn", user } | { kind: "invalid", errors } | { kind: "incorrect" } | { kind: "alreadySignedIn" }` (throws `ApiError` otherwise), and `logout(signal)`.
- `types/login.ts` (new): `LoginRequest`, `LoginField`, `LoginFieldErrors`. `types/navigationState.ts` gains `loginReason?: "required" | "expired"`.
- `stores/useLoginStore.ts` (new): mirrors `useRegistrationStore` (status `idle | pending | success | invalid | incorrect | serverError | alreadySignedIn`, field errors, `submit`, `retry`, `reset`, 10-second timeout, synchronous double-submit guard). On success it calls `useCurrentUserStore.getState().setSignedIn(user)`.
- `stores/useLogoutStore.ts` (new): status `idle | pending | serverError`, `submit`, `retry`, `reset`, 10-second timeout. On `204` it calls `setSignedOut()` and the caller navigates to `/` with the success banner message "You have logged out." (FR-017).
- `stores/useCurrentUserStore.ts`: adds `sessionExpired`, `setSignedIn(user)`, `setSignedOut()` (clears `sessionExpired`) and `markSessionEnded()` (sets `signedOut` and `sessionExpired` only when the state was `signedIn`). `refresh()` also sets `sessionExpired` when it moves from `signedIn` to `signedOut`.
- `helpers/safeReturnTo.ts` (new): accepts only internal paths (research section 8). `helpers/loginDestination.ts` (new): `Suspended` → `/account-suspended`; else safe `returnTo`; else `/` for every role (FR-010, FR-011).
- `pages/LoginPage.tsx` (new) and `components/loginForm.tsx` (new): heading "Log in", title "Log in - Spėk laiku", fields "Email" and "Password", button "Log in", link to Register, the reason message from router state in a `role="status"` region, "Logging you in…" while pending, the incorrect-credentials message once at the top linked to both fields with `aria-describedby`, the existing `ErrorSummary`, Retry on server error. The email is kept and the password cleared after a failure (FR-006). `alreadySignedIn` refreshes the current user and opens `/` (FR-013).
- `pages/AccountSuspendedPage.tsx` (new): heading "Account suspended", title "Account suspended - Spėk laiku", the FR-021 text.
- `components/signedInOnly.tsx` (new): guard for pages that need login. It refreshes the current user when the route opens; a signed-out user is sent to `/login?returnTo=<path>` with `loginReason` "expired" if `sessionExpired`, else "required" (FR-020). No route uses it yet; it is tested with a test-only route.
- `components/suspendedOnly.tsx` (new): shows its page only to a signed-in Suspended user, else navigates to `/` (FR-021).
- `components/topNavigation.tsx`: visitor sees Home, Log in, Register; any signed-in user sees Home and a **Log out** button (FR-016). `components/logoutButton.tsx` (new) runs the logout store; on failure `components/logoutError.tsx` (new) shows "Error: Something went wrong. Try again." with Retry in a `role="alert"` region under the navigation in `layout.tsx`.
- `components/appRoutes.tsx`: adds `/login` (inside `SignedOutOnly`) and `/account-suspended` (inside `suspendedOnly`).
- `tests/setup.ts`: resets the two new stores after each test.

**Origins and CSRF**: Unchanged: same origin through the Vite proxy, no CORS policy. No antiforgery token: `SameSite=Lax` plus JSON-only `POST` bodies block cross-site requests (research section 6).

**Storage**: PostgreSQL through `ApplicationDbContext`. **No migration**: the Identity lockout columns already exist.

**Testing**: Backend unit tests for `LoginValidator`, `EmailFormat` (moved tests) and `LoginService` (result per case, lockout transition, one log entry through a capturing logger, no email or password in it). Integration tests against Testcontainers PostgreSQL for every row of the authorization table in `contracts/auth-api.md`, the cookie on success, identical `401` bodies, the lockout sequence (lock end simulated by setting `LockoutEnd` in the past) and the cookie options. Frontend tests with Vitest for the Log in page states, stores, helpers, guards, navigation and logout, plus accessibility and 320 px CSS checks as in feature 001.

**Target Platform**: Web application, same browsers and server as feature 001.

**Project Type**: Full-stack web application.

**Performance Goals**: Login in under 30 seconds for the user (SC-001); a single database lookup and one password hash check per attempt.

**Constraints**: Same message for unknown email, wrong password and locked account; no email or password in logs; server-side validation; accessibility and 320 px layout; `AuthController` and every new class under 200 lines.

**Scale/Scope**: Two endpoints, two pages, one guard per access rule; no production user-volume target.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- PASS (I Code quality): The email rule is shared through `EmailFormat` instead of copied (DRY). Each new class has one responsibility and stays under 200 lines; `AuthController` stays thin.
- PASS (II Architecture): The controller handles only HTTP, the signed-in check and the cookie; credential checks, lockout and logging live in `LoginService`. Services use Identity's managers (which use `ApplicationDbContext`); no repository layer. All I/O is async. Responses are DTOs (`CurrentUserResponse`), never entities. No schema change, so no migration.
- PASS (III Testing): Backend unit and integration tests and frontend tests are planned for every state. Each endpoint has authorization tests for visitors and signed-in users. No test touches external services. Time-dependent lockout expiry is tested by setting `LockoutEnd`, not by waiting.
- PASS (IV Security): ASP.NET Core Identity for password checks and lockout; no custom hashing. Server-side validation. One message for all credential failures (no account enumeration). No password or email in logs. Same-origin cookie, no CORS. Open redirect prevented by `safeReturnTo`. OWASP: broken authentication (lockout), broken access control (authorization tests), injection (EF Core parameterized queries), security logging (lockout entry).
- PASS (V Version control): Work is on `002-user-login`, created from an updated `main`.
- PASS (VI Documentation): README gets a short "Log in and log out" note and the manual role/status test steps; the spec already records the clarified behaviour.
- PASS (VII AI use): Spec, clarifications and plan exist before implementation.
- PASS (VIII Simplicity): No new dependency, no migration, built-in Identity lockout instead of a custom limiter. `signedInOnly` is required now by spec FR-020 and the clarified assumption, not speculative.

**Post-design re-check**: PASS. The contracts, data model and quickstart introduce no new layer, package or violation.

## Project Structure

### Documentation (this feature)

```text
specs/002-user-login/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Technical decisions
├── data-model.md        # Account fields used, lockout states, session
├── quickstart.md        # Validation steps
├── contracts/
│   └── auth-api.md      # Login, logout and current-user API contract
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Created by /speckit-tasks
```

### Source Code (repository root)

```text
backend/
├── src/SpekLaiku.Api/
│   ├── Controllers/AuthController.cs        # + Login, Logout
│   ├── Data/IdentityOptionsSetup.cs         # + lockout options
│   ├── DTOs/Requests/LoginRequest.cs        # new
│   ├── Services/
│   │   ├── EmailFormat.cs                   # new, shared email rule
│   │   ├── RegistrationValidator.cs         # uses EmailFormat
│   │   ├── LoginValidator.cs                # new
│   │   ├── LoginService.cs                  # new
│   │   └── LoginResult.cs                   # new
│   └── Program.cs                           # registers LoginService
└── tests/
    ├── SpekLaiku.UnitTests/                  # LoginValidator, EmailFormat, LoginService tests
    └── SpekLaiku.IntegrationTests/           # Login, logout, lockout and authorization endpoint tests

frontend/src/
├── api/authApi.ts                            # + login, logout
├── types/login.ts, types/navigationState.ts
├── stores/useLoginStore.ts, useLogoutStore.ts, useCurrentUserStore.ts
├── helpers/safeReturnTo.ts, loginDestination.ts
├── pages/LoginPage.tsx, AccountSuspendedPage.tsx
├── components/loginForm.tsx, signedInOnly.tsx, suspendedOnly.tsx, logoutButton.tsx,
│             logoutError.tsx, topNavigation.tsx, layout.tsx, appRoutes.tsx
└── tests/                                    # Page, store, helper, guard and navigation tests
```

**Structure Decision**: Use the existing backend and frontend layout from feature 001. No new project, layer or top-level folder.

## Complexity Tracking

None. The Constitution Check has no violations to justify.
