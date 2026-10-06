---
description: "Implementation tasks for user registration and email verification"
---

# Tasks: User Registration

**Input**: Design documents from `/specs/001-user-registration/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registration-api.md, quickstart.md

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the backend and frontend projects, dependencies, configuration, and shared quality tooling.

- [ ] T001 Create the ASP.NET Core API project and React/TypeScript application structure described in the implementation plan.
- [ ] T002 Configure .NET dependencies for ASP.NET Core Identity, EF Core, PostgreSQL, AutoMapper, logging, and the selected production email provider.
- [ ] T003 Configure React dependencies, TypeScript, routing, formatting, linting, and the repository's frontend test runner.
- [ ] T004 Configure environment-specific application settings without committing secrets, real connection strings, tokens, or email credentials.
- [ ] T005 Configure backend and frontend linting, formatting, test projects, and CI-compatible commands.
- [ ] T006 Add the database context and Identity configuration required by the application.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the shared account lifecycle, email delivery contract, authorization policy, and error-handling foundation required by every user story.

- [ ] T007 [P] Add the `AccountStatus` enum and persist the new status on `ApplicationUser`, with the existing Identity schema migration.
- [ ] T008 [P] Add the asynchronous `IEmailSender` contract and a deterministic test sender that does not send real email.
- [ ] T009 [P] Add the production email-provider implementation selected in the feature plan and environment configuration.
- [ ] T010 [P] Add centralized API validation and error handling that returns safe messages and does not expose passwords, tokens, or stack traces.
- [ ] T011 [P] Add an authorization requirement that permits only authenticated users whose account status is `Active` and whose email is confirmed.
- [ ] T012 [P] Add the registration and verification DTOs and AutoMapper configuration described in the API contract.
- [ ] T013 [P] Add backend unit tests for account-status transitions, validation, authorization, and email-sender failure behavior.

**Checkpoint**: Foundation ready - user story implementation can begin in parallel.

## Phase 3: User Story 1 - Register with Valid Details (Priority: P1) 🎯 MVP

**Goal**: Allow a visitor to create a Pending Verification Registered User, receive a confirmation message, and receive a safe success response.

**Independent Test**: A visitor submits an unused valid email and matching password, receives a success message, and has an account in Pending Verification without access to protected features.

### Tests for User Story 1

- [ ] T014 [P] [US1] Add backend service tests for valid registration, duplicate email handling, password validation, and failure cleanup.
- [ ] T015 [P] [US1] Add API integration tests for successful registration, duplicate registration, field-level errors, and generic technical failures.
- [ ] T016 [P] [US1] Add frontend tests for successful registration, pending-verification messaging, validation errors, and server-error states.
- [ ] T017 [P] [US1] Add an authorization test proving a Pending Verification user cannot access a protected operation.
- [ ] T017A [P] [US1] Add backend tests for valid, invalid, expired, reused, and malformed confirmation tokens.
- [ ] T017B [P] [US1] Add integration tests proving a successful token consumes the verification state and activates the account only once.

### Implementation for User Story 1

- [ ] T018 [P] [US1] Add the registration service and server-side validation for email format, email length, password length, password confirmation, and normalized uniqueness.
- [ ] T019 [P] [US1] Add account creation that sets role to Registered User, status to Pending Verification, email confirmation to false, and registration date to UTC.
- [ ] T020 [US1] Add the registration endpoint and response mapping in the controller, using the registration service and DTOs.
- [ ] T021 [US1] Generate and send an email-confirmation token through `IEmailSender` after account creation.
- [ ] T022 [US1] Add pending-session handling so registration can sign in without granting protected access.
- [ ] T023 [US1] Add the registration page and API client, including required labels, field hints, accessible error links, and responsive layout.
- [ ] T024 [US1] Add the pending-verification screen and ensure protected application controls are unavailable until verification.
- [ ] T024A [US1] Add the verification service and endpoint that validates a signed token, checks expiry, prevents reuse, and activates the account only after successful validation.
- [ ] T024B [US1] Add a one-hour confirmation-token expiry policy and record verification attempt details without storing raw tokens.
- [ ] T024C [US1] Add the verification response and UI flow that confirms success, redirects to the home page, and shows a clear failure state for expired or invalid tokens.

**Checkpoint**: User Story 1 is fully functional and independently testable.

## Phase 4: User Story 2 - Understand and Fix Invalid Details (Priority: P1)

**Goal**: Show specific validation messages next to each invalid field and preserve the entered email after a failed submission.

**Independent Test**: A visitor submits empty, malformed, short, and mismatched values and receives field-specific messages with keyboard focus on the first invalid field.

### Tests for User Story 2

- [ ] T025 [P] [US2] Add backend tests for every server-side validation message and no account creation on invalid input.
- [ ] T026 [P] [US2] Add API integration tests for field-level validation and empty password fields.
- [ ] T027 [P] [US2] Add frontend tests for messages, retained email, cleared passwords, focus movement, and accessible error associations.

### Implementation for User Story 2

- [ ] T028 [P] [US2] Add reusable server-side registration validation with the exact required messages.
- [ ] T029 [US2] Add registration response mapping that preserves the entered email while clearing password values in the UI.
- [ ] T030 [US2] Add frontend validation and error-state rendering with labels, hints, error links, and keyboard focus behavior.
- [ ] T031 [US2] Add accessible validation feedback suitable for keyboard and screen-reader users at 320 px width.

**Checkpoint**: User Story 2 is independently testable and does not depend on successful account creation.

## Phase 5: User Story 3 - Registration Is Not Offered to Signed-In Users (Priority: P2)

**Goal**: Redirect an authenticated user who opens the registration page to the home page.

**Independent Test**: A signed-in user opens the registration route and is redirected without creating another account.

### Tests for User Story 3

- [ ] T032 [P] [US3] Add frontend route tests proving authenticated users are redirected away from registration.
- [ ] T033 [P] [US3] Add API or route authorization tests proving the registration endpoint is not used to change an existing user's account.

### Implementation for User Story 3

- [ ] T034 [P] [US3] Add the signed-in-user registration-route guard and redirect behavior.
- [ ] T035 [US3] Add the registration endpoint guard so authenticated requests cannot create another account.

**Checkpoint**: User Story 3 is independently testable.

## Phase 6: User Story 4 - Register with Keyboard, Screen Reader, and Phone (Priority: P2)

**Goal**: Ensure the registration and verification experience is usable through keyboard, assistive technology, and small screens.

**Independent Test**: A visitor can complete registration using only the keyboard, and the form fits a 320 px-wide viewport without horizontal scrolling.

### Tests for User Story 4

- [ ] T036 [P] [US4] Add keyboard-navigation tests for every field and action.
- [ ] T037 [P] [US4] Add accessibility tests for labels, hints, errors, focus, and screen-reader announcements.
- [ ] T038 [P] [US4] Add responsive tests for a 320 px viewport and verify no horizontal scrolling.

### Implementation for User Story 4

- [ ] T039 [P] [US4] Add semantic form controls, visible labels, descriptive hints, and linked errors.
- [ ] T040 [US4] Add logical keyboard focus order and accessible submit behavior.
- [ ] T041 [US4] Apply responsive styling that keeps all controls usable at 320 px without horizontal scrolling.

**Checkpoint**: User Story 4 is independently testable.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Complete security, lifecycle, migration, documentation, and end-to-end validation.

- [ ] T042 [P] Add the EF Core migration for the account-status field and verify it against the Identity schema.
- [ ] T043 [P] Add verification endpoint tests for valid, invalid, expired, reused, and malformed tokens.
- [ ] T044 [P] Add authorization tests for Pending Verification, Active, and Suspended users.
- [ ] T045 [P] Add email-delivery failure tests using the deterministic fake sender.
- [ ] T046 [P] Add route and navigation tests for registration, verification, and pending states.
- [ ] T047 [P] Update the feature documentation and quickstart validation steps for the selected email provider.
- [ ] T048 [P] Add security review checks confirming passwords, tokens, and message bodies are never logged or returned.
- [ ] T049 [P] Run backend restore, build, formatting, unit tests, and integration tests.
- [ ] T050 [P] Run frontend lint, tests, and production build.
- [ ] T051 [P] Run the quickstart validation and confirm all acceptance scenarios.
- [ ] T052 [P] Review the final diff for unrelated files, debug code, secrets, and generated artifacts.

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1: Setup has no dependencies.
- Phase 2: Foundational depends on Phase 1 and blocks all user stories.
- Phase 3: User Story 1 depends on Phase 2 and is the MVP.
- Phase 4: User Story 2 depends on Phase 2 and may run after or in parallel with User Story 1.
- Phase 5: User Story 3 depends on Phase 2 and may run in parallel with other stories.
- Phase 6: User Story 4 depends on Phase 2 and may run in parallel with other stories.
- Phase 7: Polish depends on all requested user stories and the foundation.

### User Story Dependencies

- User Story 1: No dependency on another user story; it provides the account lifecycle used by later stories.
- User Story 2: Can run independently but shares the registration service and UI with User Story 1.
- User Story 3: Can run independently but depends on the backend authorization foundation.
- User Story 4: Can run independently but shares the registration and verification UI.

### Parallel Opportunities

- Setup and foundational tasks marked `[P]` can run in parallel when files do not conflict.
- User Story 1, 2, 3, and 4 can proceed in parallel after Phase 2 when team capacity permits.
- Tests for a user story may run in parallel with implementation tasks for other files, but tests should be written before implementation for the same behavior.
- The final polish tasks can run in parallel after all story checkpoints pass.

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete User Story 1 and its tests.
3. Validate the registration and pending-verification behavior before starting later stories.
4. Add User Story 2, User Story 3, and User Story 4 incrementally.

### Incremental Delivery

Each user story is a complete, independently testable increment. The foundation is completed before stories begin, while later stories may proceed in parallel.

## Notes

- Every user-story task includes an exact file path.
- Tests are included because the specification requires automated behavior tests and the constitution requires tests for relevant screens and protected operations.
- Tests must fail before the corresponding implementation is added.
- No task creates or changes the application before the required foundation is complete.
