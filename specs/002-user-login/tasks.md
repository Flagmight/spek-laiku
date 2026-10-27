---
description: "Implementation tasks for user login and logout"
---

# Tasks: User Login and Logout

**Input**: Design documents from `/specs/002-user-login/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.md, quickstart.md

**Tests**: Required by constitution III. Every story phase has test tasks, written together with the code. Each protected or role-dependent operation has an authorization test.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently. Messages are written without the "Error: " prefix where they come from the API, and with it where they are shown on screen (spec FR-008).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1 to US6)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the starting point. No new project, package or migration is needed (plan.md, research.md sections 2 and 10).

- [X] T001 From the repository root run `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx`, and from `frontend/` run `npm run lint`, `npm test` and `npm run build`, to confirm the baseline from feature 001 passes before any change. Record any pre-existing failure instead of fixing it in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pieces that several stories use: the shared email rule, the login request DTO, the frontend login types and the current-user store actions.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `backend/src/SpekLaiku.Api/Services/EmailFormat.cs`, a static class with `public const int MaxLength = 254` and `public static bool IsValid(string email)`, moving the body of `IsValidEmailFormat` from `backend/src/SpekLaiku.Api/Services/RegistrationValidator.cs` unchanged ("No spaces, exactly one "@", at least one character before it, and a domain after it that contains a dot that is neither its first nor its last character"). Change `RegistrationValidator` to call `EmailFormat.IsValid` and `EmailFormat.MaxLength`, and remove `RegistrationValidator.MaxEmailLength` (update its usages in `backend/tests/`). Registration behaviour must not change (research section 7).
- [X] T003 [P] Add `backend/tests/SpekLaiku.UnitTests/EmailFormatTests.cs` with cases for: valid address, missing "@", two "@", nothing before "@", domain without a dot, dot as first or last domain character, a space inside, and exactly 254 versus 255 characters checked together with `MaxLength`. Run the existing registration validation tests to confirm they still pass.
- [X] T004 [P] Create `backend/src/SpekLaiku.Api/DTOs/Requests/LoginRequest.cs`: `public sealed record LoginRequest(string? Email, string? Password)` with a comment explaining why the fields are nullable (as in `RegistrationRequest`), and a `PrintMembers` override that writes `Email = {Email}, Password = ***` so the password never reaches a log (spec FR-022). Add a unit test in `backend/tests/SpekLaiku.UnitTests/LoginRequestTests.cs` that `ToString()` does not contain the password.
- [X] T005 [P] Create `frontend/src/types/login.ts` with `LoginRequest { email: string; password: string }`, `LoginField = "email" | "password"` and `LoginFieldErrors = Partial<Record<LoginField, string>>`. In `frontend/src/types/navigationState.ts` add `loginReason?: "required" | "expired"` with a comment that the Log in page shows it (spec FR-020).
- [X] T006 In `frontend/src/stores/useCurrentUserStore.ts` add `sessionExpired: boolean` (initially `false`, also in `initialCurrentUserState`) and three actions: `setSignedIn(user)` sets `{ status: "signedIn", user, sessionExpired: false }`; `setSignedOut()` sets `{ status: "signedOut", user: null, sessionExpired: false }`; `markSessionEnded()` sets `{ status: "signedOut", user: null }` and `sessionExpired: true` only when the current status is `"signedIn"`. Each action also increases `latestRequest` so a slower `refresh()` that started earlier cannot overwrite it. Change `refresh()` so that when it moves the state from `"signedIn"` to `"signedOut"` it also sets `sessionExpired: true` (research section 9).
- [X] T007 Extend `frontend/src/tests/useCurrentUserStore.test.tsx` with tests for: `setSignedIn` and `setSignedOut` set the expected state; `markSessionEnded` sets `sessionExpired` only from `"signedIn"`; `refresh()` returning `401` after `"signedIn"` sets `sessionExpired`; `setSignedOut()` never sets it; an action called while a `refresh()` is pending is not overwritten by that refresh.
- [X] T007A [P] Add `backend/tests/SpekLaiku.UnitTests/IdentityTestHost.cs`, a disposable helper for login unit tests that builds a `ServiceCollection` with `AddLogging` plus a capturing logger provider in `backend/tests/SpekLaiku.UnitTests/CapturingLoggerProvider.cs` (the same behaviour as the one in `SpekLaiku.IntegrationTests`), `AddDbContext<ApplicationDbContext>` on the EF Core in-memory provider with a unique database name per instance, `AddHttpContextAccessor()`, `AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies()` and `AddIdentityCore<ApplicationUser>(IdentityOptionsSetup.Configure).AddSignInManager().AddEntityFrameworkStores<ApplicationDbContext>()`. It exposes the real `UserManager<ApplicationUser>`, `SignInManager<ApplicationUser>`, an `ILogger<LoginService>`-compatible logger factory, the captured log entries, and `CreateUserAsync(email, password, role = "Registered User", status = AccountStatus.Active)`. `TestUserManager` is not used for login because it replaces `CreateAsync`. No new package: `Microsoft.EntityFrameworkCore.InMemory` is already referenced. Add one smoke test that a user created through it can pass `CheckPasswordSignInAsync`.

**Checkpoint**: Foundation ready. Registration still passes all its tests.

---

## Phase 3: User Story 1 - Log in with email and password (Priority: P1) 🎯 MVP

**Goal**: A registered user logs in from the Log in page and lands on the home page signed in.

**Independent Test**: A signed-out Active Registered User opens `/login`, enters their email and password, submits, and lands on `/` signed in, with "Log in" and "Register" no longer in the navigation. The "Log out" button from spec US1 scenario 2 is added by US4 (T044), which completes that scenario.

### Tests for User Story 1

- [X] T008 [P] [US1] Add `backend/tests/SpekLaiku.UnitTests/LoginServiceTests.cs` with tests (using `IdentityTestHost` from T007A) that `LoginService.LoginAsync` returns `Success(user)` for the correct password, accepts the email in another letter case and with spaces around it, returns `IncorrectCredentials()` for an unknown email and for a wrong password, and passes the password to Identity unchanged (no trimming; a password with a trailing space does not match the same password without it).
- [X] T009 [P] [US1] Add `backend/tests/SpekLaiku.IntegrationTests/LoginEndpointTests.cs` (Testcontainers PostgreSQL through `PostgreSqlApiFactory`) with tests that `POST /api/auth/login` with correct details returns `200` with `{ email, role: "Registered User", accountStatus: "Active" }`, sets the sign-in cookie, and that a following `GET /api/auth/me` with that cookie returns `200`; that an unknown email and a wrong password both return `401` with title and detail "Incorrect email or password." and set no cookie; and that the response body never contains the password or a hash.
- [X] T010 [P] [US1] Add `frontend/src/tests/useLoginStore.test.tsx` with tests for: `submit` sets `"pending"` then `"success"` and calls `useCurrentUserStore.getState().setSignedIn` with the returned user; a second `submit` while pending is ignored (FR-013 of feature 001 pattern); a `5xx`, a network error and a request that has not answered after 10 seconds (fake timers) all give `"serverError"`; `retry()` sends the last request again; `reset()` aborts a pending request and drops its result.
- [X] T011 [P] [US1] Add `frontend/src/tests/LoginPage.test.tsx` with tests for: the page has the heading "Log in", the title "Log in - Spėk laiku", fields labelled "Email" and "Password", the button "Log in" and a link to `/register`; a successful submit opens `/` with no success banner; while pending the text "Logging you in…" is in a `role="status"` region and the button is disabled; a server error shows "Error: Something went wrong. Try again." with a Retry button, keeps both entered values, and Retry sends the same details.

### Implementation for User Story 1

- [X] T012 [US1] Create `backend/src/SpekLaiku.Api/Services/LoginResult.cs` with `Success(ApplicationUser user)`, `Invalid(IReadOnlyDictionary<string, string> errors)` and `IncorrectCredentials()` factory methods and `Succeeded`, `IsIncorrectCredentials`, `User` and `Errors` properties, following `RegistrationResult.cs`.
- [X] T013 [US1] Create `backend/src/SpekLaiku.Api/Services/LoginService.cs` with constructor parameters `UserManager<ApplicationUser>`, `SignInManager<ApplicationUser>` and `ILogger<LoginService>`, and `Task<LoginResult> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)`: trim the email, find the user with `userManager.FindByEmailAsync` (case-insensitive through the normalized email), return `IncorrectCredentials()` when there is no user, otherwise call `signInManager.CheckPasswordSignInAsync(user, request.Password!, lockoutOnFailure: true)` and return `Success(user)` only when it succeeded, else `IncorrectCredentials()`. The password is never trimmed or changed (spec FR-003). Until US2 adds `LoginValidator`, return `IncorrectCredentials()` when the email or password is null or empty, so an empty form never causes a `500`; T026 replaces this guard with the validator. Lockout logging is added in US2. Register the service with `AddScoped<LoginService>()` in `backend/src/SpekLaiku.Api/Program.cs`.
- [X] T014 [US1] In `backend/src/SpekLaiku.Api/Controllers/AuthController.cs` add `[AllowAnonymous] [HttpPost("login")] Login(LoginRequest request, CancellationToken cancellationToken)` with `ProducesResponseType` attributes for `200` (`CurrentUserResponse`), `400`, `401`, `403` and `500`. Inject `LoginService` and `SignInManager<ApplicationUser>`. On success call `signInManager.SignInAsync(result.User, isPersistent: false)` and return `mapper.Map<CurrentUserResponse>(result.User)`. On incorrect credentials return `Problem(title: "Incorrect email or password.", detail: "Incorrect email or password.", statusCode: 401)`. On invalid fields return `400` `ValidationProblemDetails` exactly like `RegistrationController`. Keep the controller under 200 lines and free of business rules (constitution II).
- [X] T015 [P] [US1] In `frontend/src/api/authApi.ts` add `login(request: LoginRequest, signal?: AbortSignal): Promise<LoginOutcome>` with `LoginOutcome = { kind: "signedIn"; user: CurrentUser } | { kind: "invalid"; errors: LoginFieldErrors } | { kind: "incorrect" } | { kind: "alreadySignedIn" }`: `200` → `signedIn` with the parsed body, `400` with `errors.email`/`errors.password` → `invalid` (first message per field), `401` → `incorrect`, `403` → `alreadySignedIn`, anything else throws `ApiError` (network and abort errors pass through), following `registrationApi.ts`.
- [X] T016 [US1] Create `frontend/src/stores/useLoginStore.ts` following `useRegistrationStore.ts`: `loginTimeoutMs = 10_000`; `LoginStatus = "idle" | "pending" | "success" | "invalid" | "incorrect" | "serverError" | "alreadySignedIn"`; state `status`, `errors`, `lastRequest`, `controller`; actions `submit(request)` (ignored while `"pending"`, read through `get()`), `retry()` and `reset()`. On `signedIn` it calls `useCurrentUserStore.getState().setSignedIn(outcome.user)` and resolves with the user so the page can choose the destination. Reset the store after each test in `frontend/src/tests/setup.ts`.
- [X] T017 [US1] Create `frontend/src/components/loginForm.tsx` with labelled inputs "Email" (`type="email"`, `autoComplete="email"`) and "Password" (`type="password"`, `autoComplete="current-password"`), the submit button "Log in", the pending text "Logging you in…" in a `role="status"` region, and on `"serverError"` the message "Error: Something went wrong. Try again." (through `formatErrorMessage`) with a Retry button that calls `retry()`. Typed values stay in component state. Keep the component under about 200 lines.
- [X] T018 [US1] Create `frontend/src/pages/LoginPage.tsx`: `usePageTitle("Log in")`, one `<h1>` "Log in", the `loginForm`, and the link "Create an account" to `/register`. After a successful submit navigate to `/` with `replace: true` (US3 adds role, status and return-to destinations). Call the store's `reset()` when the page unmounts.
- [X] T019 [US1] In `frontend/src/components/appRoutes.tsx` add the route `login` rendering `LoginPage` inside `SignedOutOnly`. In `frontend/src/components/topNavigation.tsx` show "Log in" (`NavLink` to `/login`) next to "Register" for visitors under the same condition as "Register", and neither for a signed-in user (spec FR-016). Replace the comment that says there is no Log in link until feature 002. Update `frontend/src/tests/topNavigation.test.tsx` for both states.

**Checkpoint**: A registered user can log in and lands on the home page; an empty form gets `401`, never `500`.

---

## Phase 4: User Story 2 - Understand a failed login (Priority: P1)

**Goal**: Clear field messages, one shared message for wrong credentials, and a 15-minute lockout after 5 failed attempts, without revealing which accounts exist.

**Independent Test**: Submit an empty form, then an invalid email, then an unknown email, then a wrong password 5 times followed by the correct password: each step shows the expected message and nobody is signed in.

### Tests for User Story 2

- [X] T020 [P] [US2] Add `backend/tests/SpekLaiku.UnitTests/LoginValidatorTests.cs` with tests for each message: email empty or only spaces → `"Enter your email address."`; invalid format or longer than 254 characters → `"Enter a valid email address."`; password empty → `"Enter your password."`; both empty → both keys, in the order `email`, `password`; a password of only spaces is not empty and passes.
- [X] T021 [P] [US2] Extend `backend/tests/SpekLaiku.UnitTests/LoginServiceTests.cs` with tests that: invalid fields return `Invalid` without looking up the user or counting an attempt; the 5th wrong password in a row locks the account; a locked account returns `IncorrectCredentials()` even with the correct password; the lock writes exactly one `Warning` log entry that contains the account `Id` and contains neither the email nor the password (read the entries captured by `IdentityTestHost`); a successful login, a failed login and an attempt on an already locked account write no log entry; a successful login resets `AccessFailedCount` to 0; the lock does not change `AccountStatus`.
- [X] T022 [P] [US2] Add `backend/tests/SpekLaiku.IntegrationTests/LoginValidationEndpointTests.cs` with tests that: empty and missing fields return `400` with the messages from `contracts/auth-api.md` for `email` and `password` at once; a body that is not valid JSON returns `errors.request`; an unknown email, a wrong password and a locked account return identical `401` status and body; after 5 wrong passwords the correct password returns `401`; after setting the account's `LockoutEnd` to a past time in the database the correct password returns `200`; a form-encoded body is rejected with `415`.
- [X] T023 [P] [US2] Add `frontend/src/tests/LoginPageValidation.test.tsx` with tests that: an empty submit shows "Error: Enter your email address." and "Error: Enter your password." next to their fields and an error summary listing both with links that move focus to the fields; a single field error shows no summary; an `incorrect` outcome shows "Error: Incorrect email or password." once at the top of the form, linked to both inputs through `aria-describedby`; after any failure the email is kept, the password is empty, and focus moves to the first invalid field, or to the email field for `incorrect`.

### Implementation for User Story 2

- [X] T024 [US2] Create `backend/src/SpekLaiku.Api/Services/LoginValidator.cs`, a static class with `Validate(LoginRequest request)` returning `IReadOnlyDictionary<string, string>` keyed `email`, `password` in that order: email trimmed; empty → `"Enter your email address."`; `Length > EmailFormat.MaxLength` or `!EmailFormat.IsValid` → `"Enter a valid email address."`; password `string.IsNullOrEmpty` → `"Enter your password."`. No password length rule (contracts/auth-api.md).
- [X] T025 [US2] In `backend/src/SpekLaiku.Api/Data/IdentityOptionsSetup.cs` set `options.Lockout.MaxFailedAccessAttempts = 5`, `options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15)` and `options.Lockout.AllowedForNewUsers = true`, with a comment referencing spec FR-026. No migration: the lockout columns already exist (data-model.md).
- [X] T026 [US2] In `backend/src/SpekLaiku.Api/Services/LoginService.cs` call `LoginValidator.Validate` first and return `Invalid(errors)` when it fails. Before the password check, return `IncorrectCredentials()` when `await userManager.IsLockedOutAsync(user)` is true. After `CheckPasswordSignInAsync`, when the result `IsLockedOut` (the lock started with this attempt), log `logger.LogWarning("Account {UserId} locked after repeated failed logins.", user.Id)` and return `IncorrectCredentials()`. Log nothing else (spec FR-027, research section 3).
- [X] T027 [US2] In `frontend/src/components/loginForm.tsx` show each field error from the store under its field through `formatErrorMessage`, linked with `aria-describedby` and `aria-invalid`; show the existing `ErrorSummary` with both field errors; on `"incorrect"` show "Error: Incorrect email or password." once at the top of the form in a `role="alert"` element whose id is in both inputs' `aria-describedby`. After `"invalid"` or `"incorrect"` clear the password field and move focus to the first invalid field, or to the email field for `"incorrect"` (spec FR-005, FR-006, FR-007).

**Checkpoint**: All failed-login cases show the right message, and the lockout works without revealing accounts.

---

## Phase 5: User Story 3 - Land on the right page after login (Priority: P1)

**Goal**: After login, a Suspended user lands on the Account Suspended page, a user who was sent to log in returns to the page they asked for, and everyone else lands on the home page.

**Independent Test**: Log in as a Registered User, an Administrator and a Suspended user and check each landing page; then open a protected test route as a visitor, log in and land on it.

### Tests for User Story 3

- [X] T028 [P] [US3] Add `frontend/src/tests/safeReturnTo.test.ts` with tests that `safeReturnTo` accepts `/plans` and `/plans/3?tab=a`, and returns `null` for `null`, `""`, `plans`, `//evil.example`, `/\evil.example`, `https://evil.example`, `javascript:alert(1)`, `/login`, `/login?x=1`, `/register` and `/account-suspended`.
- [X] T029 [P] [US3] Add `frontend/src/tests/loginDestination.test.ts` with tests that `loginDestination(user, returnTo)` returns `/account-suspended` for a Suspended user whatever `returnTo` is, the safe `returnTo` for an Active user, and `/` for an Active Registered User or Administrator without a safe `returnTo` (spec FR-010, FR-011).
- [X] T030 [P] [US3] Add `frontend/src/tests/signedInOnly.test.tsx` using a test-only route `/protected` wrapped in `SignedInOnly`: a visitor is sent to `/login?returnTo=%2Fprotected` and the Log in page shows "Log in to continue." in a `role="status"` region; after logging in as an Active user `/protected` opens; with `/login?returnTo=https://evil.example` the user lands on `/`.
- [X] T031 [P] [US3] Add `frontend/src/tests/AccountSuspendedPage.test.tsx` with tests that a signed-in Suspended user sees the heading "Account suspended", the title "Account suspended - Spėk laiku" and the text "Your account is suspended. Features that need an active account are blocked until an administrator reactivates it."; a visitor or an Active user who opens `/account-suspended` is sent to `/`. (The Suspended user's navigation, Home and Log out only, is tested in T040 after US4 adds the Log out button.)
- [X] T032 [P] [US3] Extend `backend/tests/SpekLaiku.IntegrationTests/LoginEndpointTests.cs` with tests that a Suspended user with the correct password gets `200` with `"accountStatus": "Suspended"` and a cookie, an Administrator gets `200` with `"role": "Administrator"`, and a Suspended user with a wrong password gets the same `401` as anyone else.

### Implementation for User Story 3

- [X] T033 [P] [US3] Create `frontend/src/helpers/safeReturnTo.ts`: `safeReturnTo(value: string | null): string | null` returns the value only if it starts with `/`, its second character is neither `/` nor `\`, and its path (before `?` or `#`) is not `/login`, `/register` or `/account-suspended`; otherwise `null` (research section 8).
- [X] T034 [P] [US3] Create `frontend/src/helpers/loginDestination.ts`: `loginDestination(user: CurrentUser, returnTo: string | null): string` returns `/account-suspended` when `user.accountStatus === "Suspended"`, else `safeReturnTo(returnTo)` when not `null`, else `/`. Comment that feature 015 changes the Administrator default to Service status (spec FR-011).
- [X] T035 [US3] In `frontend/src/pages/LoginPage.tsx` read `returnTo` from the query string with `useSearchParams` and, after success, navigate to `loginDestination(user, returnTo)` with `replace: true`. Show the router state `loginReason` above the form in a `role="status"` region: `"required"` → "Log in to continue.", `"expired"` → "Your session has expired. Log in again." (spec FR-020).
- [X] T036 [US3] Create `frontend/src/components/signedInOnly.tsx`: on mount it calls `useCurrentUserStore.getState().refresh()`; while the status is `"loading"` it renders nothing; when `"signedIn"` it renders its children; otherwise it renders `<Navigate to={"/login?returnTo=" + encodeURIComponent(pathname + search)} replace state={{ loginReason: sessionExpired ? "expired" : "required" }} />`. Comment that no route uses it yet and later features (for example 010) wrap their pages in it.
- [X] T037 [US3] Create `frontend/src/components/suspendedOnly.tsx`, which renders its children only for a signed-in user with `accountStatus === "Suspended"`, nothing while loading, and otherwise `<Navigate to="/" replace />`. Create `frontend/src/pages/AccountSuspendedPage.tsx` with `usePageTitle("Account suspended")`, one `<h1>` "Account suspended" and the paragraph "Your account is suspended. Features that need an active account are blocked until an administrator reactivates it." Add the route `account-suspended` inside `SuspendedOnly` in `frontend/src/components/appRoutes.tsx` (spec FR-021).

**Checkpoint**: Every role and status lands on its page, and return-to works only for pages inside the application.

---

## Phase 6: User Story 4 - Log out (Priority: P1)

**Goal**: A signed-in user logs out, lands on the home page as a visitor with a confirmation banner, and cannot reach anything that needs login.

**Independent Test**: A signed-in user selects "Log out", sees "✓ Success: You have logged out." on the home page with the visitor navigation, and `GET /api/auth/me` returns `401`.

### Tests for User Story 4

- [X] T038 [P] [US4] Add `backend/tests/SpekLaiku.IntegrationTests/LogoutEndpointTests.cs` with tests that `POST /api/auth/logout` from a signed-in Registered User, Administrator and Suspended user returns `204` and expires the cookie, after which `GET /api/auth/me` with the old cookie jar returns `401`; and that a request without a session also returns `204`.
- [X] T039 [P] [US4] Add `frontend/src/tests/useLogoutStore.test.tsx` with tests that `submit` sets `"pending"`, then on `204` calls `useCurrentUserStore.getState().setSignedOut()` and returns to `"idle"`; a second `submit` while pending is ignored; a `5xx`, a network error and the 10-second timeout give `"serverError"` and keep the current user signed in; `retry()` sends the request again; `sessionExpired` stays `false` after logout.
- [X] T040 [P] [US4] Add `frontend/src/tests/logout.test.tsx` with tests that a signed-in Registered User, Administrator and Suspended user each see a "Log out" button and no "Log in" or "Register", and a Suspended user sees only Home and Log out (spec US1 scenario 2, US3 scenario 6, FR-021); selecting it opens `/` with "✓ Success: You have logged out." and the visitor navigation (Home, Log in, Register); on failure "Error: Something went wrong. Try again." appears with a Retry button in a `role="alert"` region under the navigation and the Log out button is still shown.

### Implementation for User Story 4

- [X] T041 [US4] In `backend/src/SpekLaiku.Api/Controllers/AuthController.cs` add `[AllowAnonymous] [HttpPost("logout")] Logout()` that calls `signInManager.SignOutAsync()` and returns `NoContent()`, with `ProducesResponseType(204)` (contracts/auth-api.md). It has no business rules and no logging (spec FR-027).
- [X] T042 [P] [US4] In `frontend/src/api/authApi.ts` add `logout(signal?: AbortSignal): Promise<void>` that sends `POST /api/auth/logout` and throws `ApiError` for any status other than `204`.
- [X] T043 [US4] Create `frontend/src/stores/useLogoutStore.ts` with `logoutTimeoutMs = 10_000`, status `"idle" | "pending" | "serverError"`, `controller`, and `submit()`, `retry()` and `reset()` following `useLoginStore`. On success it calls `useCurrentUserStore.getState().setSignedOut()` and resolves `true`. Reset it after each test in `frontend/src/tests/setup.ts`.
- [X] T044 [US4] Create `frontend/src/components/logoutButton.tsx`, a `<button type="button">` "Log out" that calls the logout store and, on success, navigates to `/` with the router state `{ successMessage: "You have logged out." }` (spec FR-017). Create `frontend/src/components/logoutError.tsx`, which shows "Error: Something went wrong. Try again." through `formatErrorMessage` with a Retry button while the logout store is `"serverError"`, inside a `role="alert"` element. In `frontend/src/components/topNavigation.tsx` render `logoutButton` for any signed-in user, and in `frontend/src/components/layout.tsx` render `logoutError` between the `<header>` and the banner area.

**Checkpoint**: Login and logout both work; the four P1 stories are complete.

---

## Phase 7: User Story 5 - Session expiry and pages for visitors only (Priority: P2)

**Goal**: An expired session is reported on the Log in page, signed-in users never see the Log in form, and a login refused because the user is already signed in opens the home page.

**Independent Test**: Simulate an ended session on a protected test route and check the expiry message; open `/login` while signed in and land on `/`.

### Tests for User Story 5

- [X] T045 [P] [US5] Add `backend/tests/SpekLaiku.IntegrationTests/SessionOptionsTests.cs` with tests that the resolved `CookieAuthenticationOptions` for `IdentityConstants.ApplicationScheme` have `ExpireTimeSpan` of 30 minutes and `SlidingExpiration` `true` (spec FR-019), and that `POST /api/auth/login` from a signed-in user returns `403` with title "Already signed in." and does not count a failed attempt.
- [X] T046 [P] [US5] Extend `frontend/src/tests/signedInOnly.test.tsx` with tests that a user who was `"signedIn"` and whose `refresh()` now returns `401` is sent to `/login?returnTo=...` with "Your session has expired. Log in again.", and after logging in returns to that page; and that after a logout the same route shows "Log in to continue." instead.
- [X] T047 [P] [US5] Add `frontend/src/tests/loginRouteGuard.test.tsx` with tests that a signed-in user who opens `/login` is sent to `/` without the Log in page flashing up, and that an `alreadySignedIn` outcome from submitting the form opens `/` with no error message and refreshes the current user.

### Implementation for User Story 5

- [X] T048 [US5] In `backend/src/SpekLaiku.Api/Controllers/AuthController.cs` make `Login` return `Problem(title: "Already signed in.", detail: "You are already signed in.", statusCode: 403)` before calling `LoginService` when `User.Identity?.IsAuthenticated == true` (spec FR-013), as `RegistrationController` does.
- [X] T049 [US5] In `frontend/src/pages/LoginPage.tsx` handle the `"alreadySignedIn"` result: call `useCurrentUserStore.getState().refresh()` and navigate to `/` with `replace: true` and no banner. Confirm `SignedOutOnly` already redirects a signed-in user who opens `/login` (no change expected).

**Checkpoint**: Session expiry and the already-signed-in cases behave as specified.

---

## Phase 8: User Story 6 - Log in with keyboard, screen reader and on a phone (Priority: P2)

**Goal**: The Log in and Account Suspended pages work with the keyboard, a screen reader and at 320 px width.

**Independent Test**: Log in and out with the keyboard only, and open both pages at 320 px without horizontal scrolling.

### Tests for User Story 6

- [ ] T050 [P] [US6] Extend `frontend/src/tests/keyboard.test.tsx` with tests that on the Log in page the tab order is skip link, navigation (Home, Log in, Register), "Email", "Password", "Log in", "Create an account", and that the form submits with Enter; and that "Log out" can be reached and used with the keyboard.
- [ ] T051 [P] [US6] Extend `frontend/src/tests/accessibility.test.tsx` and `frontend/src/tests/layout.test.tsx` with tests that the Log in and Account Suspended pages each have exactly one `<h1>`, their page titles, and "Skip to main content" as the first focusable item; and that each field's label and error are announced through `aria-describedby` (spec FR-023, FR-025).
- [ ] T052 [P] [US6] Extend `frontend/src/tests/responsive.test.tsx` with tests that the Log in form and the Account Suspended page use the same full-width field and button rules, the 44 × 44 px minimum target size and the 16 px input text as the Register page (spec FR-024).

### Implementation for User Story 6

- [ ] T053 [US6] In `frontend/src/styles.css` apply the existing Register form rules (full-width fields and buttons below the mobile breakpoint, minimum 44 × 44 px targets, 16 px inputs, visible 2 px focus outline) to the Log in form, the Account Suspended page and the "Log out" button, reusing the existing class names where possible instead of copying rules.

**Checkpoint**: All user stories are complete.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T054 [P] Update `README.md`: add a "Log in and log out" section that describes the Log in page, the 5-attempt / 15-minute lockout and the 15 to 30 minute session, and the manual steps for testing an Administrator or Suspended account by changing `Role` or `AccountStatus` in the database (quickstart.md, Manual Validation steps 5 and 6).
- [ ] T055 [P] Check every new or changed C# class is under 200 lines (constitution I), and every new React page or component is under about 200 lines; split by responsibility if not.
- [ ] T056 Run `dotnet format .\SpekLaiku.slnx --verify-no-changes`, `dotnet build .\SpekLaiku.slnx` and `dotnet test .\SpekLaiku.slnx` from the repository root, and `npm run lint`, `npm run format:check`, `npm test` and `npm run build` from `frontend/`. Fix any failure without weakening tests or checks.
- [ ] T057 Run the manual steps in `specs/002-user-login/quickstart.md` and record the result. Then review `git diff`: no debug code, commented-out code, secrets, `.env*` or `appsettings.Development.json` changes, and no migration.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks every user story.
- **US1 (Phase 3)**: Depends on Foundational. It is the MVP.
- **US2 (Phase 4)**: Depends on US1 (extends `LoginService`, `loginForm.tsx`).
- **US3 (Phase 5)**: Depends on US1 (extends `LoginPage.tsx`). Independent of US2.
- **US4 (Phase 6)**: Depends on Foundational and on US1 for the navigation change. Independent of US2 and US3. T040 also checks the Suspended user's navigation, which needs only a Suspended current user, not the US3 pages.
- **US5 (Phase 7)**: Depends on US1 and US3 (`signedInOnly.tsx`) and US4 (logout case in T046).
- **US6 (Phase 8)**: Depends on US1, US3 and US4 (the pages and button it checks).
- **Polish (Phase 9)**: Depends on all stories.

### Within Each Story

- Tests are written with the code and must fail first where practical.
- Backend: result/validator → service → controller. Frontend: API client → store → component → page → route.

### Parallel Opportunities

- Phase 2: T003, T004, T005 and T007A in parallel after T002; T006 then T007.
- US1: T008 to T011 in parallel; T015 in parallel with the backend tasks T012 to T014.
- US2: T020 to T023 in parallel; backend T024 to T026 and frontend T027 in parallel.
- US3: T028 to T032 in parallel; T033 and T034 in parallel.
- US4: T038 to T040 in parallel; T041 in parallel with T042 to T044.
- US6: T050 to T052 in parallel.

### Parallel Example: User Story 1

```text
Together: T008 LoginServiceTests, T009 LoginEndpointTests, T010 useLoginStore tests, T011 LoginPage tests
Then backend: T012 → T013 → T014   |   frontend: T015 → T016 → T017 → T018 → T019
```

## Implementation Strategy

### MVP First

1. Phase 1 and Phase 2.
2. Phase 3 (US1): stop and check that a registered user can log in and land on the home page.

### Incremental Delivery

1. US1 → US2 (safe failures and lockout) → US3 (destinations, Account Suspended page) → US4 (logout): the four P1 stories make the feature usable.
2. US5 and US6 complete the P2 behaviour.
3. Polish, then the Pull Request with the AI review (constitution VII).

Following the agreed working rule, implementation stops after each phase for a diff review, and commits are made only on request.

## Notes

- [P] tasks touch different files and have no dependency on an unfinished task.
- No NuGet or npm package and no EF Core migration are added in this feature.
- Tests never call external services; this feature uses none.
