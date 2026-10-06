# Feature Specification: User Registration

**Feature Branch**: `001-user-registration`
**Created**: 2026-10-05
**Status**: Draft
**Input**: A visitor can create an account so that they can later save and manage their activity plans.

## Clarifications

### Session 2026-10-06

- Q: Should registration reveal whether an email already exists? → A: Yes, reveal that the email is already registered.
- Q: Should a newly registered account be usable immediately without email confirmation? → A: No, require email confirmation before the account can be used.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Register with valid details (Priority: P1)

As a visitor, I want to create an account with my email and a password so that I can save my plans and come back to them later.

**Why this priority**: Every feature that stores personal data depends on accounts. Without registration there is no Registered User.

**Independent Test**: A visitor enters a new email and a valid password twice, submits the form, and is taken to the home page as a signed-in user.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration page, **When** they enter an unused valid email, a password of at least 8 characters and the same password again and submit, **Then** an account is created, the visitor is signed in, a success message is shown and the home page opens.
2. **Given** a visitor who has just registered, **When** they look at the navigation, **Then** they see the options for a Registered User and no longer see "Log in" or "Register".
3. **Given** a visitor who has just registered, **When** they check their account role, **Then** it is Registered User, never Administrator.

---

### User Story 2 - Understand and fix invalid details (Priority: P1)

As a visitor, I want clear messages next to the fields that are wrong so that I can correct them without losing my work.

**Why this priority**: Registration is the first contact with the application. Unclear errors make visitors leave.

**Independent Test**: A visitor submits the form with an invalid email, then a short password, then mismatched passwords, and sees a specific message next to the failing field each time, with no account created.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** a visitor submits an empty form, **Then** each required field shows a message and no account is created.
2. **Given** the registration page, **When** a visitor enters an email that is not in a valid format, **Then** "Enter a valid email address." appears next to the email field.
3. **Given** the registration page, **When** a visitor enters a password shorter than 8 characters, **Then** "Password must be at least 8 characters." appears next to the password field.
4. **Given** the registration page, **When** the repeated password differs from the password, **Then** "Passwords do not match." appears next to the repeated password field.
5. **Given** an account already exists for an email, **When** a visitor registers with that email (in any letter case), **Then** "This email is already registered." appears and no second account is created.
6. **Given** a failed submission, **When** the page shows the messages, **Then** the entered email is kept, the password fields are empty and the first invalid field has keyboard focus.

---

### User Story 3 - Registration is not offered to signed-in users (Priority: P2)

As a signed-in user, I do not want to see a registration form so that I do not create a second account by mistake.

**Why this priority**: Prevents confusion and duplicate accounts, but the main flow works without it.

**Independent Test**: A signed-in user opens the registration page address and lands on the home page.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open the registration page, **Then** they are taken to the home page.

---

### User Story 4 - Register with keyboard, screen reader and on a phone (Priority: P2)

As a visitor who uses a keyboard, a screen reader or a phone, I want to complete registration in the same way as everyone else so that I am not excluded.

**Why this priority**: Accessibility and mobile use are project-wide requirements, and the form is the first screen a new user meets.

**Independent Test**: A visitor completes registration using only the keyboard, and the form is usable at a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** a visitor moves through it with the keyboard only, **Then** every field and button can be reached and used in a logical order.
2. **Given** a validation error, **When** a screen reader user reaches the affected field, **Then** the field's label, hint and error message are all announced.
3. **Given** a phone-sized screen, **When** a visitor opens the page, **Then** the form fits the width and all buttons are easy to tap.

### Edge Cases

- Email differs only in letter case from an existing one: treated as the same email and rejected as a duplicate.
- Email or password has spaces at the start or end: spaces around the email are removed before checking; spaces inside a password are allowed.
- Email is longer than 254 characters or password longer than 128 characters: rejected with a clear message.
- The submit button is pressed twice quickly: only one account is created.
- The service fails while creating the account: a message "Account could not be created. Try again later." is shown and no partial account remains.
- The visitor edits the page or sends the request without using the form: the same checks still apply.
- A visitor with an unsaved plan registers: keeping that plan is handled by the Save and View Plans feature, not here.

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST allow a visitor to create an account by entering an email address, a password and the password again.
- **FR-002**: The system MUST require all three fields.
- **FR-003**: The system MUST accept only a valid email format of up to 254 characters, ignore spaces around it, and treat emails that differ only in letter case as the same email.
- **FR-004**: The system MUST allow only one account per email address.
- **FR-005**: The system MUST require a password of 8 to 128 characters.
- **FR-006**: The system MUST require the repeated password to match the password.
- **FR-007**: The system MUST create every new account as a Registered User in a Pending Verification status and MUST NOT allow anyone to become an Administrator through registration.
- **FR-008**: After successful registration the system MUST sign the user in, show a success message and open the home page.
- **FR-009**: The system MUST NOT show a password after it is entered, MUST NOT return it in any response, MUST NOT write it to logs, and MUST keep it only in a protected form that cannot be read back.
- **FR-010**: The system MUST show each validation problem as text next to the affected field, using these messages: "Enter a valid email address.", "This email is already registered.", "Password must be at least 8 characters.", "Passwords do not match." The system MUST reveal that an email is already registered when the submitted email belongs to an existing account.
- **FR-011**: After a failed submission the system MUST keep the entered email, clear the password fields and move keyboard focus to the first invalid field.
- **FR-012**: The system MUST check all input on the server, even if the browser also checks it.
- **FR-013**: The system MUST prevent two accounts being created when the form is submitted more than once quickly.
- **FR-014**: The system MUST send a signed-in user who opens the registration page to the home page.
- **FR-015**: If account creation fails for a technical reason, the system MUST show "Account could not be created. Try again later." and MUST NOT leave a partial account.
- **FR-016**: The registration page MUST have a visible label for every field, link each hint and error message to its field, and be usable by keyboard and screen reader.
- **FR-017**: The registration page MUST work on desktop and mobile screens, down to 320 px wide, without horizontal scrolling.
- **FR-018**: The system MUST create a new account in a Pending Verification status, require the visitor to confirm their email address before the account can be used, and prevent access to protected application features until verification succeeds.

### Key Entities

- **User Account**: a person's account in the application. Has an email address (unique), a protected password, a role (Registered User or Administrator), a status (Pending Verification, Active or Suspended) and a registration date.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor who enters valid details can complete registration in under 1 minute.
- **SC-002**: 100% of submissions with missing or invalid details show a specific message next to each failing field and create no account.
- **SC-003**: No two accounts can exist for the same email, including emails that differ only in letter case and duplicate quick submissions.
- **SC-004**: A password never appears in readable form on any screen, in any stored data, in any response or in any log.
- **SC-005**: The whole registration can be completed using only the keyboard, and every field label, hint and error is announced by a screen reader.
- **SC-006**: The page fits a 320 px wide screen with no horizontal scrolling.

## Assumptions

- Passwords are limited by length only (8 to 128 characters); no extra complexity rules are required in this version.
- The interface uses one language.
- Administrator accounts are created outside registration (by the project owner), not through this feature.
- The sign-in session that registration starts is the same one that the Login feature (002) uses.
- Password reset ("forgot password") is not needed in this version.

## Dependencies

- None. This is the first feature. The Login and Logout feature (002), Save and View Plans (010) and Account Deletion (016) depend on it.
- Related UX material: the Register screen wireframe and the Registration flow from the UX design document.

## Scope Boundaries

**In scope**: the registration page, validation, creating a Registered User account, email verification, signing the new user in, the messages and the redirect after success.

**Out of scope**: password reset, login and logout screens (feature 002), creating administrators, social sign-in, editing a profile, keeping a visitor's unsaved plan (feature 010) and deleting an account (feature 016).

## Traceability to project requirements

| Project requirement                          | Covered by                         |
| -------------------------------------------- | ---------------------------------- |
| FR-001, FR-002 (register an account)         | FR-001 to FR-008, FR-013 to FR-015 |
| FR-046 (password rule and repeated password) | FR-005, FR-006                     |
| NFR-003 (server-side validation)             | FR-012                             |
| NFR-005, NFR-006 (protection of passwords)   | FR-009                             |
| NFR-009, NFR-015 (labels and errors)         | FR-010, FR-016                     |
| NFR-011 (desktop and mobile layout)          | FR-017                             |
| NFR-013 (email verification)                 | FR-018                             |
