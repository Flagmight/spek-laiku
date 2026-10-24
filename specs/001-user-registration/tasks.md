---
description: "Implementation tasks for user registration"
---

# Tasks: User Registration

**Input**: Design documents from `/specs/001-user-registration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registration-api.md, quickstart.md

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the backend and frontend projects, dependencies, configuration, and shared quality tooling.

- [X] T001 Create the ASP.NET Core API project and React/TypeScript application structure described in the implementation plan.
- [X] T002 Configure .NET dependencies for ASP.NET Core Identity, EF Core, PostgreSQL, AutoMapper, logging, and SendGrid.
- [X] T003 Configure React dependencies, TypeScript, routing, formatting, linting, and the repository's frontend test runner.
- [X] T004 Configure environment-specific application settings without committing secrets, real connection strings, tokens, or email credentials.
- [X] T005 Configure backend and frontend linting, formatting, test projects, and CI-compatible commands.
- [X] T006 Add the database context and Identity configuration required by the application.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared account lifecycle, sign-in session, current-user endpoint, test database, and error-handling foundation required by every user story. (T008 and T009 built an email delivery contract that T013A removes.)

- [X] T007 [P] Add the `AccountStatus` enum and persist the new status on `ApplicationUser`; the initial Identity schema migration is created in T042 because this repository has no existing migration.
- [X] T008 [P] Add the asynchronous `IEmailSender` contract and a deterministic test sender that does not send real email.
- [X] T009 [P] Add the production email-provider implementation selected in the feature plan and environment configuration.
- [X] T010 [P] Add centralized API validation and error handling that returns safe messages and does not expose passwords, tokens, or stack traces.
- [X] T011 [P] Add an authorization requirement that permits only authenticated users whose account status is `Active` and whose email is confirmed.
- [X] T012 [P] Add the registration and verification DTOs and AutoMapper configuration described in the API contract.
- [X] T013 [P] Add backend unit tests for account-status transitions, validation, authorization, and email-sender failure behavior.

**Scope change (2026-10-13)**: Email confirmation was removed from this feature, and the maximum password length was removed (spec clarification session 2026-10-13). T008, T009 and parts of T002, T007, T011, T012 and T013 were built for email confirmation. The tasks below remove that work.

- [X] T013A Remove the email-confirmation code that is no longer in scope: `IEmailSender`, the deterministic test sender, `SendGridEmailSender`, `SendGridOptions`, `EmailOptions`, `VerificationService`, `VerificationResult`, the verification request and response DTOs and their mappings, the SendGrid package, and the `SendGrid` and email settings in `appsettings.json`. Remove the tests that only cover the removed code (`VerificationServiceTests`, `VerificationTokenFactory` and the email-sender tests). Remove the SendGrid and email settings paragraph from `README.md` and the sentence about "registration and verification endpoints". Also remove the unused `EmailConfirmed` override from `ApplicationUser` (the column comes from `IdentityUser` and stays) and `AddDefaultTokenProviders()` from the Identity setup in `backend/src/SpekLaiku.Api/Program.cs`, because email confirmation, password reset and two-factor authentication are out of scope (`docs/architecture.md`).
- [X] T013B Change `AccountStatus` to `Active` and `Suspended` only, with `Active` as the default, and remove `VerificationSentAt` and `VerificationAttemptedAt` from `ApplicationUser`.
- [X] T013C Remove the `ActiveAccount` authorization policy, which no endpoint in this feature uses (constitution VIII): `ActiveAccountRequirement`, `ActiveAccountAuthorizationHandler`, their registration in `backend/src/SpekLaiku.Api/Program.cs`, and `ActiveAccountAuthorizationHandlerTests`. The first feature that protects an endpoint by account status adds the policy with its tests.
- [X] T013D Add `SignInManager` to the Identity setup and configure the application cookie (HttpOnly, Secure, SameSite=Lax, 30-minute sliding expiration) in `backend/src/SpekLaiku.Api/Program.cs`.
- [X] T013E Add `GET /api/auth/me`, which returns `200` with the signed-in user's email, role and account status as a response DTO for any signed-in user (including a Suspended one) or `401` when not signed in, and the frontend hook `frontend/src/hooks/useCurrentUser.ts` that reads it through the API client in `frontend/src/api/`. Add authorization tests for signed-in and signed-out requests.
- [X] T013F Add the `Testcontainers.PostgreSql` package to `backend/tests/SpekLaiku.IntegrationTests` and a PostgreSQL test fixture that starts a container and creates the schema from the current model, including the unique index on the normalized email. Update `README.md` Prerequisites: replace "PostgreSQL (local or hosted; Docker is optional)" with "PostgreSQL (local or hosted)" and add "Docker (required to run the backend integration tests, which start PostgreSQL with Testcontainers)".
- [X] T013F1 Let the PostgreSQL test fixture run without Docker: when the environment variable `SPEKLAIKU_TEST_POSTGRES` holds a connection string to an existing PostgreSQL server, the fixture creates a uniquely named throwaway database on that server instead of starting a container, and drops it after the tests. When the variable is not set, the fixture uses Testcontainers as before (CI is unchanged). Document the variable in `README.md` Prerequisites and in `quickstart.md`.
- [X] T013G Add `frontend/vite.config.ts` with the React plugin and a dev-server proxy that forwards `/api` to `https://localhost:7254` (`secure: false` for the local development certificate). Make the API client in `frontend/src/api/` call relative `/api/...` URLs with `credentials: "same-origin"`. Set Vitest's test environment to jsdom in the same file.
- [X] T013H Set up React Router in `frontend/src/main.tsx` with the routes `/` and `/register` and a shared layout in `frontend/src/components/` with a `<nav>` area (filled by T022B), the banner area and `<main id="main-content">`. Add `frontend/src/pages/HomePage.tsx` as a minimal placeholder with the application name as its main heading and the success banner component (`frontend/src/components/successBanner.tsx`), which shows a message passed as router state and stays until dismissed. Add a frontend test that `/` renders the home page and that a banner message passed as router state is shown and can be dismissed.
- [X] T013I In the shared layout from T013H, add a "Skip to main content" link as the first focusable element, pointing to `<main id="main-content">`. Add `frontend/src/hooks/usePageTitle.ts`, which sets the browser tab title to "<Page> - Spėk laiku". Add tests that the skip link is the first focusable item and moves focus to the main content.
- [X] T013J On `HomePage.tsx`, set the title "Home - Spėk laiku" with `usePageTitle`, and make sure the page has exactly one `<h1>`, "Spėk laiku". Add a test for the title and the single heading (FR-021).
- [X] T013K Add `frontend/src/helpers/formatErrorMessage.ts`, which puts "Error: " in front of a message, and a unit test for it. Every error message the frontend shows goes through this helper (FR-019); API messages never contain the prefix.
- [X] T013L Set `options.User.AllowedUserNameCharacters = string.Empty` in the Identity setup in `backend/src/SpekLaiku.Api/Program.cs`, so that any email the registration service accepts is also a valid Identity user name (FR-003).

**Checkpoint**: Foundation ready - user story implementation can begin in parallel.

## Phase 3: User Story 1 - Register with Valid Details (Priority: P1) 🎯 MVP

**Goal**: Allow a visitor to create an Active Registered User, be signed in, and land on the home page with a success message.

**Independent Test**: A visitor submits an unused valid email and matching password, is signed in, sees the success banner on the home page, and has an Active Registered User account.

### Tests for User Story 1

- [X] T014 [P] [US1] Add backend service tests in `backend/tests/SpekLaiku.UnitTests/RegistrationServiceTests.cs` for valid registration (role is Registered User, never Administrator; status is Active; spaces around the email are removed), duplicate email in any letter case, and failure cleanup. Validation messages are tested in T025.
- [X] T014A [P] [US1] Add unit tests in `backend/tests/SpekLaiku.UnitTests/RegistrationServiceTests.cs` using a test `UserManager` subclass whose `CreateAsync` throws a `DbUpdateException` wrapping a `PostgresException` with SQL state `23505`: one test for `EmailIndex` and one for `UserNameIndex`, each checking that `RegisterAsync` returns "This email is already registered.". Add one test with a different SQL state checking that a technical failure is returned (the controller maps it to `500`). Add two more tests where `CreateAsync` returns `IdentityResult.Failed` with code `DuplicateEmail`, and with code `DuplicateUserName`, each checking that `RegisterAsync` returns "This email is already registered.". Add one test with another failure code (for example `InvalidUserName`) checking that a technical failure is returned.
- [X] T015 [P] [US1] Add API integration tests in `backend/tests/SpekLaiku.IntegrationTests/` for successful registration (201 and the sign-in cookie is set), duplicate registration (`400` with `errors.email` = "This email is already registered."), and technical failures (`500` problem details with no partial account), as defined in the contract. Field-level errors are tested in T026.
- [X] T015A [P] [US1] Add an integration test, using the Testcontainers PostgreSQL fixture from T013F, that sends two identical registration requests at the same time and checks that exactly one account exists and the other request returns "This email is already registered." The test checks only the outcome, because either the service's pre-check or the database index may stop the second request; T014A covers the index path deterministically.
- [X] T016 [P] [US1] Add frontend tests for the loading state (message "Creating your account…" shown and announced, submit disabled, 10-second timeout shows the FR-015 message), success (home page opens and shows the banner "✓ Success: Account created."), the server-error state ("Error: Something went wrong. Try again." with a Retry button after a `500`, a network error and the 10-second timeout; entered values are kept; Retry sends the same request again), and that clicking submit twice sends one request. The validation-error state is tested in T027 (US2).

### Implementation for User Story 1

- [X] T018 [P] [US1] Add the registration service and server-side validation in `backend/src/SpekLaiku.Api/Services/RegistrationService.cs` for required fields, email format (FR-003 rule), email length, password minimum length of 8 with no maximum, password confirmation, and normalized uniqueness. Check all three fields and return every failing field at once, one message per field, in the order defined in the contract, with the exact FR-010 messages; run the duplicate check only when the fields are otherwise valid. Make the fields of `RegistrationRequest` nullable so that empty or missing values reach the service instead of producing the generic "Invalid value." model-validation error.
- [X] T018A [US1] In `backend/src/SpekLaiku.Api/Services/RegistrationService.cs`, return "This email is already registered." when `UserManager.CreateAsync` either returns a failed `IdentityResult` with code `DuplicateEmail` or `DuplicateUserName`, or throws a `DbUpdateException` whose inner `PostgresException` has SQL state `23505` on `EmailIndex` or `UserNameIndex` (both hold the normalized email). Any other failed `IdentityResult` or database error returns a technical failure, which the controller maps to `500` as in the contract.
- [X] T019 [US1] Add account creation that sets role to Registered User, status to Active, and registration date to UTC.
- [X] T020 [US1] Add the registration endpoint and response mapping in the controller, using the registration service and DTOs.
- [X] T022 [US1] Sign the new user in after successful registration, using the cookie session from T013D that the Login feature (002) will reuse.
- [X] T022A [US1] After successful registration, navigate to `/` and pass "Account created." as router state, so the home page from T013H shows the banner "✓ Success: Account created." until the user dismisses it (FR-008), and refresh the current-user state from `useCurrentUser` so that the navigation hides "Register" (US1 scenario 2).
- [X] T022B [US1] Add the top navigation component in `frontend/src/components/` and render it in the `<nav>` area of the layout from T013H: a visitor sees Home and Register; a signed-in user (from `useCurrentUser`) sees Home only (US1 scenario 2). There is no Log in link until feature 002 adds the Log in page.
- [X] T022C [US1] Add `frontend/src/hooks/useRegistration.ts`. It sends the registration request through the API client in `frontend/src/api/`, holds the request state (idle, pending, success, validation errors, server error, already signed in), applies the 10-second timeout from FR-018, ignores a second submit while a request is pending, and returns the per-field errors from a `400`. Retry sends the last request again. Add unit tests for each state, using fake timers for the timeout.
- [X] T023 [US1] Add `frontend/src/components/registrationForm.tsx` with the three fields and their visible labels "Email", "Password" and "Confirm password", the submit button and the loading text from FR-018. Add `frontend/src/pages/RegisterPage.tsx`, which connects `useRegistration` to the form and handles navigation after success (T022A) and after a `403` (T035A). The password hint and linked errors are added in T039, validation rendering in T030, and the responsive layout in T041. The password values are sent exactly as typed, without trimming. The "Password" and "Confirm password" inputs use `type="password"` and `autocomplete="new-password"`. The email input uses `type="email"` and `autocomplete="email"`. The form has `noValidate`, so the browser's own validation bubbles never replace the FR-010 messages.
- [X] T023B [US1] On `RegisterPage.tsx`, add the single `<h1>` "Register" and set the title "Register - Spėk laiku" with `usePageTitle`. Add a test for both (FR-021).
- [X] T023A [US1] In `registrationForm.tsx`, disable the submit button while `useRegistration` reports a pending request, so a second click sends no request.
- [X] T023C [US1] In `registrationForm.tsx`, using the server-error state from `useRegistration`, for any `5xx` response, a network error or the FR-018 timeout, show "Error: Something went wrong. Try again." (through `formatErrorMessage`) with a Retry button. Keep all entered values, and make Retry send the same request again (FR-015). Never show the server's text.

**Checkpoint**: User Story 1 is fully functional and independently testable.

## Phase 4: User Story 2 - Understand and Fix Invalid Details (Priority: P1)

**Goal**: Show specific validation messages next to each invalid field and preserve the entered email after a failed submission.

**Independent Test**: A visitor submits empty, malformed, short, and mismatched values and receives field-specific messages with keyboard focus on the first invalid field.

### Tests for User Story 2

- [X] T025 [P] [US2] Add backend tests for every FR-010 message (each empty field, invalid email, email longer than 254 characters, password shorter than 8, mismatched passwords), that a very long password is accepted, and that no account is created on invalid input. Also test that a valid email with less common characters (for example `o'brien@example.com`) is accepted and creates an account, and that `a@b`, `a@b.`, `@b.lt` and `a b@c.lt` get "Enter a valid email address.". Also test that a password with spaces at the start and end (for example `"  abcdef"`, 8 characters) is accepted, and that the stored account accepts exactly that password and rejects the trimmed version (`UserManager.CheckPasswordAsync`).
- [X] T026 [P] [US2] Add API integration tests that invalid input returns `400` problem details with `errors` keyed by `email`, `password` and `passwordConfirmation`: each invalid field gets its FR-010 message, several invalid fields are all returned in one response, empty and missing fields get the "empty" messages, and a body that is not valid JSON returns `errors.request`.
- [X] T027 [P] [US2] Add frontend tests for messages, retained email, cleared passwords, focus movement, and accessible error associations. Also test that every shown message starts with "Error:", that with errors in two or more fields the error summary lists every message and each link moves focus to its field, and that with one error no summary is shown.

### Implementation for User Story 2

- [X] T029 [US2] In the registration controller, map the service's per-field errors to the `400` problem-details response, technical failures to `500` and the already-signed-in case to `403`, exactly as in the contract.
- [X] T030 [US2] Add validation error rendering in `registrationForm.tsx`, using the validation errors from `useRegistration`: read `errors.email`, `errors.password` and `errors.passwordConfirmation` from a `400` response and show each message next to its field through `formatErrorMessage` (FR-019). After a validation failure, keep the email, clear the password fields and move focus to the first invalid field (FR-011), and announce the errors to screen readers. Server errors are handled in T023C.
- [X] T030A [US2] Add `frontend/src/components/errorSummary.tsx` at the top of the registration form. Show it when more than one field fails validation. It lists every field message (through `formatErrorMessage`), each as a link that moves keyboard focus to its field, and is announced to screen readers (`role="alert"`). Focus still moves to the first invalid field (FR-020, FR-011).

Server-side validation with the exact messages is part of T018. Accessible labels and layout are part of T039 and T041.

**Checkpoint**: User Story 2 is independently testable and does not depend on successful account creation.

## Phase 5: User Story 3 - Registration Is Not Offered to Signed-In Users (Priority: P2)

**Goal**: Redirect an authenticated user who opens the registration page to the home page.

**Independent Test**: A signed-in user opens the registration route and is redirected without creating another account.

### Tests for User Story 3

- [X] T032 [P] [US3] Add frontend route tests proving authenticated users are redirected away from registration.
- [X] T033 [P] [US3] Add an API integration test proving that a registration request from a signed-in user returns `403` problem details with `detail` "You are already signed in." and creates no account.

### Implementation for User Story 3

- [X] T034 [P] [US3] Add the guard on the `/register` route that redirects a signed-in user to `/`, using `useCurrentUser` from T013E.
- [X] T035 [US3] Add the registration endpoint guard so a request from a signed-in user returns `403` with "You are already signed in." and creates no account, as in the contract.
- [X] T035A [US3] When the registration request returns `403`, refresh the current-user state from `useCurrentUser` and navigate to `/` with no banner and no error message (FR-014, US3 scenario 2). Add a frontend test that a `403` opens the home page and shows no "Error:" text.

**Checkpoint**: User Story 3 is independently testable.

## Phase 6: User Story 4 - Register with Keyboard, Screen Reader, and Phone (Priority: P2)

**Goal**: Ensure the registration experience is usable through keyboard, assistive technology, and small screens.

**Independent Test**: A visitor can complete registration using only the keyboard, and the form fits a 320 px-wide viewport without horizontal scrolling.

### Tests for User Story 4

- [X] T036 [P] [US4] Add keyboard-navigation tests for every field and action.
- [X] T037 [P] [US4] Add accessibility tests for labels, hints, errors, focus, and screen-reader announcements. Also check, on both the Register and Home pages, that "Skip to main content" is the first focusable item and moves focus to the main content, that there is exactly one `<h1>`, and that the tab titles are "Register - Spėk laiku" and "Home - Spėk laiku".
- [X] T038 [P] [US4] Add responsive tests that check the CSS rules for a 320 px viewport (no horizontal scrolling, full-width fields and buttons) and touch targets of at least 44 × 44 px. The real size check is the manual quickstart step at 320 px, because jsdom does not measure layout.

### Implementation for User Story 4

- [X] T039 [P] [US4] Use semantic form controls (each label tied to its input from T023), add the hint "At least 8 characters." under "Password", and hints and errors linked to their fields with `aria-describedby`.
- [X] T040 [US4] In `registrationForm.tsx`, make the keyboard focus order Email, Password, Confirm password, submit button, and make pressing Enter in any field submit the form.
- [X] T041 [US4] Apply responsive styling that keeps all controls usable at 320 px without horizontal scrolling, with touch targets of at least 44 × 44 px and input text of at least 16 px.

**Checkpoint**: User Story 4 is independently testable.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete security, lifecycle, migration, documentation, and end-to-end validation.

- [X] T042 [P] Add the initial EF Core Identity schema migration, including the account-status field, and verify it against the configured model. Then switch the T013F test fixture to apply migrations instead of creating the schema from the model.
- [X] T046 [P] Add navigation tests for T022B: a visitor sees Home and Register, a signed-in user sees Home only, and there is no Log in link.
- [X] T047 [P] Update the feature documentation, the quickstart and `README.md` (running the API with the https profile and the frontend through the dev proxy), and confirm that a fresh clone passes the tests by following the README.
- [X] T048 [P] Add a backend integration test that registers with a known password and checks that (1) neither the `201` response body nor any `400` or `500` response body contains the password, (2) log output captured with a test logger provider for the whole request contains no password, and (3) the stored `PasswordHash` is not the password. Add a frontend test that both password inputs have `type="password"` (FR-009, SC-004).
- [X] T049 Run backend restore, build, formatting, unit tests, and integration tests.
- [X] T050 Run frontend lint, tests, and production build.
- [x] T051 Run the quickstart validation and confirm all acceptance scenarios.
- [X] T052 Review the final diff for unrelated files, debug code, secrets, and generated artifacts.

## Phase 8: Zustand Frontend State (Requirement Change 2026-10-24)

**Purpose**: Move the signed-in state and the registration submission state into Zustand stores, as required by `docs/requirements.md` (Constraints) and described in plan.md (Frontend state). Behaviour, messages and accessibility stay exactly as before, so every existing frontend test must keep passing.

- [X] T053 Add the `zustand` package (latest stable release) to `frontend/package.json`.
- [X] T054 Add `frontend/src/stores/useCurrentUserStore.ts` with the status, the user and `refresh()`, keeping the rule that only the most recent request updates the state. Start the first load in `frontend/src/main.tsx` and `frontend/src/tests/renderApp.tsx`. Switch `topNavigation.tsx`, `signedOutOnly.tsx` and `RegisterPage.tsx` to the store, and remove `CurrentUserProvider` and `hooks/useCurrentUser.ts`.
- [X] T055 Add `frontend/src/stores/useRegistrationStore.ts` with the status, the field errors, `submit`, `retry` and `reset`, keeping the double-submit guard (FR-013), the 10-second timeout (FR-018) and Retry with the last request (FR-015). `RegisterPage.tsx` calls `reset()` on unmount. Remove `hooks/useRegistration.ts`.
- [X] T056 Reset both stores after each test in `frontend/src/tests/setup.ts`. Move the hook tests to `useCurrentUserStore.test.tsx` and `useRegistrationStore.test.tsx`, and add tests that only the latest current-user request updates the store and that leaving the register page aborts a pending request and starts the next visit idle.
- [X] T057 Run frontend lint, format check, tests and production build.

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: Setup has no dependencies.
- Phase 2: Foundational depends on Phase 1 and blocks all user stories. T013A to T013C must be done before T018, T019 and T042. T013D and T013E must be done before T022, T032 and T034. T013F must be done before T015A. T013G must be done before T013E, T013H, T023 and T034. T013H must be done before T022A, T022B, T023 and T034. T042 may run any time after T013B. T049 to T052 run last, in order. T013I must be done after T013H, and T013J after T013I. T013K must be done before T023C and T030. T013L must be done before T018 and T025. T035A must be done after T023 and T013E. T022C must be done before T023, T023A, T023C, T030 and T035A. T023B must be done after T023 and T013I. T030A must be done after T030.
- Phase 3: User Story 1 depends on Phase 2 and is the MVP.
- Phase 4: User Story 2 depends on Phase 2 and may run after or in parallel with User Story 1.
- Phase 5: User Story 3 depends on Phase 2 and may run in parallel with other stories.
- Phase 6: User Story 4 depends on Phase 2 and may run in parallel with other stories.
- Phase 7: Polish depends on all requested user stories and the foundation, except T042, which may run any time after T013B.
- Phase 8: Zustand frontend state depends on Phase 7. T053 runs first, T054 before T055, and T057 last.

### User Story Dependencies

- User Story 1: No dependency on another user story; it provides the account lifecycle used by later stories.
- User Story 2: Can run independently but shares the registration service and UI with User Story 1.
- User Story 3: Can run independently but depends on the backend authorization foundation.
- User Story 4: Can run independently but shares the registration UI.

### Parallel Opportunities

- Setup and foundational tasks marked `[P]` can run in parallel when files do not conflict.
- User Story 1, 2, 3, and 4 can proceed in parallel after Phase 2 when team capacity permits.
- Tests for a user story may run in parallel with implementation tasks for other files, but tests should be written before implementation for the same behavior.
- The polish tasks marked `[P]` (T042 to T048) can run in parallel after all story checkpoints pass. T049 to T052 run last, in order.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 and its tests.
3. Validate the registration behavior before starting later stories.
4. Add User Story 2, User Story 3, and User Story 4 incrementally.

### Incremental Delivery

Each user story is a complete, independently testable increment. The foundation is completed before stories begin, while later stories may proceed in parallel.

## Notes

- Tasks name a file path where it is known. Other tasks follow the folder structure in plan.md.
- Existing code: parts of US1 (`RegistrationService`, DTOs, mappings) were written before these tasks. Treat that code as a starting point. A task is done when its code matches the task and the specification and its tests pass. Change or remove existing code that does not match.
- Tests are included because the specification requires automated behavior tests and the constitution requires tests for relevant screens and protected operations.
- Write tests before implementation. For behaviour that existing code already implements, the test must fail when that behaviour is broken (for example by temporarily changing the expected message) before it counts as done.
- No task creates or changes the application before the required foundation is complete.
