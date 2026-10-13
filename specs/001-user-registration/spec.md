# Feature Specification: User Registration

**Feature Branch**: `001-user-registration`
**Created**: 2026-10-05
**Status**: Draft
**Input**: A visitor can create an account so that they can later save and manage their activity plans.

## Clarifications

### Session 2026-10-06

- Q: Should registration reveal whether an email already exists? → A: Yes, reveal that the email is already registered.
- Q: Should a newly registered account be usable immediately without email confirmation? → A: No, require email confirmation before the account can be used. (Superseded in session 2026-10-13.)

### Session 2026-10-13

- Q: Is email confirmation part of this feature? → A: No. Email confirmation is out of scope, as decided in `docs/architecture.md` section 10. A new account can be used immediately. This replaces the 2026-10-06 answer.
- Q: Is there a maximum password length? → A: No. The only password length rule is a minimum of 8 characters, as in project requirement FR-045.
- Q: What happens right after a successful registration? → A: The user is signed in, the home page opens and the banner "✓ Success: Account created." is shown until dismissed (FR-008). This matches `docs/ux-design.md` section 6 ("Account created, user goes to Home") and the Save plan journey, where a newly registered visitor continues signed in.
- Q: What are the field labels, hint and empty-field messages? → A: Labels "Email", "Password" and "Confirm password" (from `docs/ux-design.md` Form 1); hint "At least 8 characters." under "Password"; empty-field messages "Error: Enter your email address.", "Error: Enter a password." and "Error: Confirm your password." (FR-001, FR-010, FR-016).
- Q: What is shown while the request is in progress? → A: "Creating your account…", announced to screen readers, with the submit button disabled; after 10 seconds without an answer the FR-015 message is shown (FR-018, from `docs/ux-design.md` section 6).
- Q: What happens when a signed-in user sends a registration request directly? → A: It is refused (`403`) and no account is created.
- Q: Is it a problem if the 10-second timeout is reached but the account is still created? → A: It is accepted as a known limitation of this version; a retry shows "Error: This email is already registered." and the user can log in through feature 002.
- Q: Does the navigation show "Log in" before the Login feature (002) exists? → A: No. Until feature 002 adds the Log in page, the navigation shows only Home and Register to a visitor, so there is no link to a page that does not exist.
- Q: How are error messages marked? → A: Every error message starts with "Error:", so that errors are not shown by colour alone (`docs/ux-design.md` section 9.4). The messages in this specification are written as shown on screen, with the prefix. The frontend adds the prefix; messages returned by the API do not contain it (FR-019).
- Q: What does the form show when a submission has several errors? → A: An error summary at the top of the form: a list of the error messages, each a link that moves focus to its field. Focus still moves to the first invalid field (`docs/ux-design.md` section 9.4, FR-020).
- Q: What page structure does every page need? → A: One main heading, a browser tab title in the form "<Page> - Spėk laiku" and a "Skip to main content" link as the first focusable item, on both the Register page and the Home page (project NFR-014, `docs/ux-design.md` section 9.3, FR-021).
- Q: Which text is shown for a technical failure? → A: The UX server error text "Error: Something went wrong. Try again." with a Retry button (`docs/ux-design.md` section 6). It replaces "Account could not be created. Try again later." (FR-015).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Register with valid details (Priority: P1)

As a visitor, I want to create an account with my email and a password so that I can save my plans and come back to them later.

**Why this priority**: Every feature that stores personal data depends on accounts. Without registration there is no Registered User.

**Independent Test**: A visitor enters a new email and a valid password twice, submits the form, and is taken to the home page as a signed-in user.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration page, **When** they enter an unused valid email, a password of at least 8 characters and the same password in "Confirm password" and submit, **Then** an account is created, the visitor is signed in, the home page opens and the success banner from FR-008 is shown.
2. **Given** a visitor who has just registered, **When** they look at the navigation, **Then** they no longer see "Register". ("Log in" is added to the navigation by feature 002 and is hidden for signed-in users in the same way.)
3. **Given** a visitor who has just registered, **When** they check their account role, **Then** it is Registered User, never Administrator.
4. **Given** a visitor who has submitted valid details, **When** the server has not answered yet, **Then** the text "Creating your account…" is shown and announced to screen readers, and the submit button is disabled.
5. **Given** a visitor who has submitted valid details, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Something went wrong. Try again." is shown with a Retry button, the entered values are kept, and selecting Retry sends the same details again.

---

### User Story 2 - Understand and fix invalid details (Priority: P1)

As a visitor, I want clear messages next to the fields that are wrong so that I can correct them without losing my work.

**Why this priority**: Registration is the first contact with the application. Unclear errors make visitors leave.

**Independent Test**: A visitor submits the form with an invalid email, then a short password, then mismatched passwords, and sees a specific message next to the failing field each time, with no account created.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** a visitor submits an empty form, **Then** each required field shows its "Error: …" message, the error summary lists all three, and no account is created.
2. **Given** the registration page, **When** a visitor enters an email that is not in a valid format, **Then** "Error: Enter a valid email address." appears next to the email field.
3. **Given** the registration page, **When** a visitor enters a password shorter than 8 characters, **Then** "Error: Password must be at least 8 characters." appears next to the password field.
4. **Given** the registration page, **When** "Confirm password" differs from "Password", **Then** "Error: Passwords do not match." appears next to the "Confirm password" field.
5. **Given** an account already exists for an email, **When** a visitor registers with that email (in any letter case), **Then** "Error: This email is already registered." appears and no second account is created.
6. **Given** a submission that fails validation, **When** the page shows the messages, **Then** the entered email is kept, the password fields are empty and the first invalid field has keyboard focus.
7. **Given** a submission with errors in more than one field, **When** the page shows the messages, **Then** an error summary at the top of the form lists every error message, and selecting a message in the summary moves keyboard focus to its field.

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
3. **Given** a phone-sized screen, **When** a visitor opens the page, **Then** the form fits the width without horizontal scrolling, fields and buttons are full width, every button and link is at least 44 × 44 px, and input text is at least 16 px.
4. **Given** the Register page or the Home page, **When** a keyboard user presses Tab once, **Then** the first focused item is "Skip to main content", and selecting it moves focus to the main content; each page has exactly one main heading and a browser tab title that names the page ("Register - Spėk laiku", "Home - Spėk laiku").

### Edge Cases

- Email differs only in letter case from an existing one: treated as the same email and rejected as a duplicate.
- Email or password has spaces at the start or end: spaces around the email are removed before checking; spaces inside a password are allowed.
- Email is longer than 254 characters: rejected with "Error: Enter a valid email address." next to the email field.
- Password is very long: accepted, because there is no maximum password length.
- The submit button is pressed twice quickly: only one account is created.
- The service fails while creating the account: "Error: Something went wrong. Try again." is shown with a Retry button, and no partial account remains.
- The visitor edits the page or sends the request without using the form: the same checks still apply.
- A signed-in user sends a registration request directly, without the page: the request is refused and no account is created.
- The 10-second timeout from FR-018 is reached but the server still creates the account afterwards: the visitor sees the FR-015 message; if they select Retry or submit again with the same email they see "Error: This email is already registered." and can log in through the Login feature (002). This is a known limitation of this version.
- A visitor with an unsaved plan registers: keeping that plan is handled by the Save and View Plans feature, not here.

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST allow a visitor to create an account by entering an email address, a password and the password again, in fields labelled "Email", "Password" and "Confirm password".
- **FR-002**: The system MUST require all three fields.
- **FR-003**: The system MUST accept only a valid email format of up to 254 characters, ignore spaces around it, and treat emails that differ only in letter case as the same email.
- **FR-004**: The system MUST allow only one account per email address.
- **FR-005**: The system MUST require a password of at least 8 characters and MUST NOT set a maximum password length.
- **FR-006**: The system MUST require "Confirm password" to match "Password".
- **FR-007**: The system MUST create every new account as an Active Registered User and MUST NOT allow anyone to become an Administrator through registration.
- **FR-008**: After successful registration the system MUST sign the user in, open the home page and show the banner "✓ Success: Account created." that stays until the user dismisses it.
- **FR-009**: The system MUST NOT show a password after it is entered, MUST NOT return it in any response, MUST NOT write it to logs, and MUST keep it only in a protected form that cannot be read back.
- **FR-010**: The system MUST show each validation problem as text next to the affected field, showing every failing field at once with one message per field, using these messages: "Error: Enter your email address." (email empty), "Error: Enter a valid email address." (invalid format or longer than 254 characters), "Error: This email is already registered.", "Error: Enter a password." (password empty), "Error: Password must be at least 8 characters.", "Error: Confirm your password." ("Confirm password" empty), "Error: Passwords do not match." The system MUST reveal that an email is already registered when the submitted email belongs to an existing account.
- **FR-011**: After a submission fails validation the system MUST keep the entered email, clear the password fields and move keyboard focus to the first invalid field.
- **FR-012**: The system MUST check all input on the server, even if the browser also checks it.
- **FR-013**: The system MUST prevent two accounts being created when the form is submitted more than once quickly.
- **FR-014**: The system MUST send a signed-in user who opens the registration page to the home page.
- **FR-015**: If account creation fails for a technical reason, the server does not answer within 10 seconds (FR-018), or the network fails, the system MUST show "Error: Something went wrong. Try again." with a Retry button, MUST keep the entered values so that Retry sends the same details again, MUST NOT show technical details, and MUST NOT leave a partial account.
- **FR-016**: The registration page MUST have a visible label for every field, show the hint "At least 8 characters." under the "Password" field, link each hint and error message to its field, and be usable by keyboard and screen reader.
- **FR-017**: The registration page MUST work on desktop and mobile screens, down to 320 px wide, without horizontal scrolling.
- **FR-018**: While the registration request is in progress, the system MUST show the text "Creating your account…" (never a spinner alone), announce it to assistive technology without moving focus, and disable the submit button. If the server has not answered after 10 seconds, the system MUST show the message from FR-015.
- **FR-019**: Every error message the system shows MUST start with "Error:", so that errors are not identified by colour alone. The prefix is added by the frontend; messages returned by the API do not contain it.
- **FR-020**: When a submission fails validation in more than one field, the system MUST show an error summary at the top of the form that lists every error message, each as a link that moves keyboard focus to its field, and MUST announce the summary to assistive technology. Keyboard focus still moves to the first invalid field (FR-011).
- **FR-021**: Every page in this feature (Register and Home) MUST have exactly one main heading, a browser tab title in the form "<Page> - Spėk laiku" ("Register - Spėk laiku", "Home - Spėk laiku"), and a "Skip to main content" link as the first focusable item that moves focus to the main content. The main heading is "Register" on the Register page and "Spėk laiku" on the Home page.

### Key Entities

- **User Account**: a person's account in the application. Has an email address (unique), a protected password, a role (Registered User or Administrator), a status (Active or Suspended) and a registration date.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A visitor who enters valid details can complete registration in under 1 minute.
- **SC-002**: 100% of submissions with missing or invalid details show a specific message next to each failing field and create no account.
- **SC-003**: No two accounts can exist for the same email, including emails that differ only in letter case and duplicate quick submissions.
- **SC-004**: A password never appears in readable form on any screen, in any stored data, in any response or in any log.
- **SC-005**: The whole registration can be completed using only the keyboard, and every field label, hint and error is announced by a screen reader.
- **SC-006**: The page fits a 320 px wide screen with no horizontal scrolling.

## Assumptions

- Passwords need only a minimum length of 8 characters; no maximum length and no extra complexity rules are required in this version.
- Email confirmation is not required in this version; a new account can be used immediately.
- The interface uses one language.
- Administrator accounts are created outside registration (by the project owner), not through this feature.
- This feature creates the sign-in session that the Login feature (002) will reuse. The session ends after 30 minutes of inactivity (project NFR-016).
- The registration page has no empty state.
- The home page does not exist yet. This feature adds a minimal home page with the application name and the area where the FR-008 banner appears. Its real content (starting a plan, saved plans) comes from later features.
- Password reset ("forgot password") is not needed in this version.

## Dependencies

- None. This is the first feature. The Login and Logout feature (002), Save and View Plans (010) and Account Deletion (016) depend on it.
- Related UX material: the Register screen wireframe and the Registration flow from the UX design document.

## Scope Boundaries

**In scope**: the registration page, validation, creating a Registered User account, signing the new user in, the messages and the redirect after success.

**Out of scope**: email confirmation, password reset, login and logout screens (feature 002), creating administrators, social sign-in, editing a profile, keeping a visitor's unsaved plan (feature 010) and deleting an account (feature 016).

## Traceability to project requirements

| Source                                       | Covered by                         |
| -------------------------------------------- | ---------------------------------- |
| FR-001, FR-002 (register an account)         | FR-001 to FR-008, FR-013 to FR-015 |
| FR-045 (password rule and repeated password) | FR-005, FR-006                     |
| Constitution IV (server-side validation)     | FR-012                             |
| NFR-006 (no credentials in logs)             | FR-009                             |
| NFR-015 (errors next to the field)           | FR-010, FR-016                     |
| UX design section 9.1 (visible labels)       | FR-001, FR-016                     |
| NFR-011 (desktop and mobile layout)          | FR-017                             |
| NFR-013 (announce loading and status)        | FR-018, FR-020                     |
| NFR-014 (heading, page title, skip link)     | FR-021                             |
| UX design section 6 (server error state)     | FR-015                             |
| UX design section 9.4 (errors and summary)   | FR-019, FR-020                     |
