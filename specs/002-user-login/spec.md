# Feature Specification: User Login and Logout

**Feature Branch**: `002-user-login`
**Created**: 2026-10-26
**Status**: Draft
**Input**: A registered user can log in with their email and password and log out again, and after login lands on the right page for their role and account status (project FR-003, FR-004, FR-040, FR-041), following the Login flow, the Log in wireframe and the navigation rules in `docs/ux-design.md`.

## Clarifications

### Session 2026-10-26

- Q: Should repeated failed logins temporarily block the account? → A: Yes. After 5 failed attempts in a row for one account, the account is locked for 15 minutes. While it is locked, every login attempt for it, even with the correct password, shows "Error: Incorrect email or password.", so the lock does not reveal that the account exists. A successful login resets the count (FR-026).
- Q: Where does an Administrator land after login before the Service status page (feature 015) exists? → A: On the home page. Feature 015 changes the destination to Service status when it adds that page (FR-011).
- Q: Should the user be warned before the session expires, as `docs/ux-design.md` section 9.4 ("Timeouts") suggests? → A: No, not in this feature. After expiry the Log in page shows "Your session has expired. Log in again." A warning before expiry is out of scope (FR-020).
- Q: Should the system write a log entry for login events? → A: Only lockouts and server failures. A lockout is logged with the account's internal identifier; normal logins, failed logins and logouts are not logged (FR-027).
- Q: Is it acceptable for a session to end anywhere between 15 and 30 minutes after the user's last action, rather than exactly 30 minutes? → A: Yes. A session never lasts more than 30 minutes after the last action that needs the account and always lasts at least 15 (FR-019).
- Q: Should a banner confirm a successful login on the page the user lands on? → A: No. The landing page and the signed-in navigation show that the login worked (FR-010).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Log in with email and password (Priority: P1)

As a registered user, I want to log in with my email and password so that I can use the features that need my account, such as saving plans.

**Why this priority**: Every feature that uses personal data (saving, viewing and managing plans, administration) needs a way back into an account. Registration alone signs a user in only once.

**Independent Test**: A registered user who is signed out opens the Log in page, enters their email and password, submits, and lands on the home page as a signed-in user.

**Acceptance Scenarios**:

1. **Given** an Active Registered User who is signed out, **When** they enter their email and correct password on the Log in page and submit, **Then** they are signed in and the home page opens.
2. **Given** a user who has just logged in, **When** they look at the navigation, **Then** they see "Log out" and no longer see "Log in" or "Register".
3. **Given** a registered user, **When** they enter their email in a different letter case or with spaces around it, **Then** the login succeeds.
4. **Given** a visitor on the Log in page, **When** the server has not answered yet, **Then** the text "Logging you in…" is shown and announced to screen readers, and the submit button is disabled.
5. **Given** a visitor who has submitted the form, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Something went wrong. Try again." is shown with a Retry button, the entered values are kept, and selecting Retry sends the same details again.

---

### User Story 2 - Understand a failed login (Priority: P1)

As a visitor, I want a clear message when my login fails so that I can correct my details, without the application revealing which accounts exist.

**Why this priority**: Wrong passwords and typing mistakes are the most common login outcome after success. The message must help the user while protecting other people's accounts.

**Independent Test**: A visitor submits an empty form, then an unknown email, then a known email with a wrong password, and each time sees the expected message and stays signed out on the Log in page.

**Acceptance Scenarios**:

1. **Given** the Log in page, **When** a visitor submits an empty form, **Then** "Error: Enter your email address." and "Error: Enter your password." appear next to their fields, the error summary lists both, and nobody is signed in.
2. **Given** the Log in page, **When** a visitor enters an email that is not in a valid format, **Then** "Error: Enter a valid email address." appears next to the email field and no login is attempted.
3. **Given** the Log in page, **When** a visitor enters an email that has no account, or a registered email with a wrong password, **Then** the same message "Error: Incorrect email or password." is shown, the visitor stays on the Log in page and is not signed in.
4. **Given** a failed login, **When** the page shows the message, **Then** the entered email is kept, the password field is empty and keyboard focus moves to the first invalid field, or to the email field when the email and password were rejected together.
5. **Given** a submission with errors in more than one field, **When** the page shows the messages, **Then** an error summary at the top of the form lists every message, and selecting a message moves keyboard focus to its field.
6. **Given** an account that has had 5 failed login attempts in a row, **When** anyone tries to log in to it within the next 15 minutes, even with the correct password, **Then** "Error: Incorrect email or password." is shown and nobody is signed in; **And** after the 15 minutes the correct password works again.

---

### User Story 3 - Land on the right page after login (Priority: P1)

As a user, I want to arrive where I need to be after logging in, so that an administrator reaches their tools, a suspended user learns why they are blocked, and anyone who was sent to log in continues where they left off.

**Why this priority**: Project requirement FR-040 makes the destination after login part of logging in, and suspended users must be told why access is blocked (FR-041).

**Independent Test**: Log in once as a Registered User, once as an Administrator and once as a Suspended user, and check the page each one lands on. Then open a page that needs login as a visitor, log in, and check that the requested page opens.

**Acceptance Scenarios**:

1. **Given** an Active Administrator, **When** they log in without having requested another page, **Then** the home page opens (FR-011; feature 015 later changes this to Service status).
2. **Given** a Suspended user, **When** they log in with the correct email and password, **Then** they are signed in and the Account Suspended page opens, whatever page they had requested.
3. **Given** a Suspended user, **When** they enter a wrong password, **Then** they see "Error: Incorrect email or password." like any other user, and the page does not reveal that the account is suspended.
4. **Given** a visitor who opens a page that needs login, **When** they are sent to the Log in page, **Then** the page shows "Log in to continue.", and after a successful login as an Active user the page they asked for opens.
5. **Given** a Log in address that names a page outside this application as the place to return to, **When** the user logs in, **Then** the application ignores it and uses the normal destination for the user's role.
6. **Given** a signed-in Suspended user, **When** they look at the navigation, **Then** they see Home and Log out only.

---

### User Story 4 - Log out (Priority: P1)

As a signed-in user, I want to log out so that nobody else using the same device can act in my account.

**Why this priority**: Logging out is a basic security control and project requirement FR-004.

**Independent Test**: A signed-in user selects "Log out", lands on the home page with the visitor navigation, and can no longer reach anything that needs login without logging in again.

**Acceptance Scenarios**:

1. **Given** a signed-in Registered User, Administrator or Suspended user, **When** they select "Log out", **Then** their session ends, the home page opens with the visitor navigation (Home, Log in, Register) and the banner "✓ Success: You have logged out." is shown until dismissed.
2. **Given** a user who has logged out, **When** they use the browser Back button or open a page that needs login, **Then** they are treated as a visitor and sent to the Log in page.
3. **Given** a signed-in user whose session has already ended on the server, **When** they select "Log out", **Then** the same result as scenario 1 is shown, with no error.
4. **Given** a signed-in user, **When** the log-out request fails because of a server or network problem, **Then** "Error: Something went wrong. Try again." is shown with a Retry button and the navigation still shows the signed-in state.

---

### User Story 5 - Session expiry and pages for visitors only (Priority: P2)

As a user, I want the application to tell me when my session has ended and not to show me login or registration forms while I am signed in, so that I always know whether I am signed in.

**Why this priority**: The main flows work without it, but users would otherwise be confused by silent sign-outs and forms that do not apply to them.

**Independent Test**: Let a session pass 30 minutes without activity, try an action that needs login, and check the expiry message on the Log in page. Then, while signed in, open the Log in page address and land on the home page.

**Acceptance Scenarios**:

1. **Given** a signed-in user with no activity for 30 minutes, **When** they next try something that needs login, **Then** they are sent to the Log in page with "Your session has expired. Log in again.", and after logging in they return to the page they were on.
2. **Given** a signed-in user, **When** they open the Log in page, **Then** they are taken to the home page.
3. **Given** a visitor on the Log in page who became signed in after opening it (for example in another tab), **When** they submit the form, **Then** the home page opens with no error message.
4. **Given** a signed-in user, **When** they keep using the application with less than 15 minutes between actions that need their account, **Then** they stay signed in.

---

### User Story 6 - Log in with keyboard, screen reader and on a phone (Priority: P2)

As a user who uses a keyboard, a screen reader or a phone, I want to log in and out in the same way as everyone else.

**Why this priority**: Accessibility and mobile use are project-wide requirements.

**Independent Test**: A user logs in and out using only the keyboard, and the Log in and Account Suspended pages are usable at a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the Log in page, **When** a user moves through it with the keyboard only, **Then** every field, link and button can be reached and used in a logical order.
2. **Given** a validation or login error, **When** a screen reader user reaches the affected field, **Then** the field's label and error message are both announced.
3. **Given** a phone-sized screen, **When** a user opens the Log in or Account Suspended page, **Then** the content fits the width without horizontal scrolling, fields and buttons are full width, every button and link is at least 44 × 44 px, and input text is at least 16 px.
4. **Given** the Log in or Account Suspended page, **When** a keyboard user presses Tab once, **Then** the first focused item is "Skip to main content"; each page has exactly one main heading and a browser tab title that names the page ("Log in - Spėk laiku", "Account suspended - Spėk laiku").

### Edge Cases

- Email differs only in letter case from the registered one, or has spaces around it: treated as the same email and the login succeeds.
- Password has spaces at the start or end: it is used exactly as entered and is never trimmed, so it matches only if the registered password has the same spaces.
- Email longer than 254 characters: "Error: Enter a valid email address." and no login is attempted.
- The submit button is pressed twice quickly: the user ends up with one signed-in session and lands on one page.
- Repeated wrong passwords for one account: after 5 failed attempts in a row the account is locked for 15 minutes, and every attempt during the lock shows "Error: Incorrect email or password.", even with the correct password (FR-026).
- Failed attempts with an email that has no account: the same message is shown; nothing is locked because there is no account.
- The 10-second timeout is reached but the server still signs the user in afterwards: the visitor sees the FR-014 message; Retry or a new submission then opens the home page (FR-013).
- The "return to" address points outside the application, to the Log in or Register page itself, or to a page that does not exist: it is ignored, or the Not Found page is shown for a missing page inside the application.
- A Registered User returns to an administrator page after login: the page is refused as for any Registered User (Access Denied is handled by the feature that owns that page).
- A user is suspended by an administrator while signed in: handled by the Administrator Account Access Management feature (014), not here.
- A user logs out in one tab while another tab is open: the other tab is treated as signed out the next time it needs the account.
- A visitor with an unsaved plan logs in: keeping that plan is handled by the Save and View Plans feature (010), not here.

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST provide a Log in page where a visitor enters an email and a password, in fields labelled "Email" and "Password", and submits with a button labelled "Log in". The page MUST also offer a link to the Register page.
- **FR-002**: The system MUST require both fields and MUST check the email format with the same rule as registration: spaces around it are removed, at most 254 characters, no spaces, exactly one "@", at least one character before it, and a domain after it that contains a dot that is neither its first nor its last character. Emails that differ only in letter case are the same email.
- **FR-003**: The system MUST sign the user in only when the email belongs to an account and the password matches it exactly. The password is never trimmed or changed.
- **FR-004**: The system MUST show the same message, "Error: Incorrect email or password.", when the email has no account and when the password is wrong, and MUST NOT reveal in any message or response to a failed login whether an account exists or is suspended.
- **FR-005**: The system MUST show each validation problem as text next to the affected field, using these messages: "Error: Enter your email address." (email empty), "Error: Enter a valid email address." (invalid format or longer than 254 characters), "Error: Enter your password." (password empty). "Error: Incorrect email or password." is shown once at the top of the form and is linked to both fields.
- **FR-006**: After a failed login the system MUST keep the entered email, clear the password field and move keyboard focus to the first invalid field, or to the email field when the login was rejected as incorrect.
- **FR-007**: When a submission fails validation in more than one field, the system MUST show an error summary at the top of the form that lists every error message, each as a link that moves keyboard focus to its field, and MUST announce the summary to assistive technology.
- **FR-008**: Every error message the system shows MUST start with "Error:". The prefix is added by the frontend; messages returned by the API do not contain it.
- **FR-009**: The system MUST check all login input on the server, even if the browser also checks it.
- **FR-010**: After a successful login, the system MUST send a Suspended user to the Account Suspended page; otherwise it MUST send the user to the page they requested before logging in, if there is one; otherwise it MUST send a Registered User to the home page and an Administrator to the administrator landing page (FR-011). No success banner is shown after login.
- **FR-011**: The administrator landing page after login MUST be the home page until the Service status feature (015) replaces it with the Service status page.
- **FR-012**: The system MUST accept a "return to" page only if it is a page inside this application, and MUST ignore any other value, including addresses of other websites and the Log in and Register pages.
- **FR-013**: The system MUST send a signed-in user who opens the Log in page to the home page. If a login request is refused because the user is already signed in, the system MUST open the home page without an error message.
- **FR-014**: If login fails for a technical reason, the server does not answer within 10 seconds, or the network fails, the system MUST show "Error: Something went wrong. Try again." with a Retry button, MUST keep the entered values so that Retry sends the same details again, and MUST NOT show technical details.
- **FR-015**: While the login request is in progress, the system MUST show the text "Logging you in…" (never a spinner alone), announce it to assistive technology without moving focus, and disable the submit button. If the server has not answered after 10 seconds, the system MUST show the message from FR-014.
- **FR-016**: The system MUST show "Log in" in the navigation to visitors, next to "Register", and MUST show "Log out" instead of both to every signed-in user (Registered User, Administrator and Suspended user).
- **FR-017**: When a signed-in user selects "Log out", the system MUST end their session on the server, open the home page with the visitor navigation and show the banner "✓ Success: You have logged out." that stays until dismissed. If the session had already ended, the result MUST be the same, with no error. If the request fails, the system MUST show the FR-014 message with a Retry button and keep the signed-in state.
- **FR-018**: After logout, the system MUST treat the user as a visitor in every tab and for every request; nothing that needs login may be reached without logging in again.
- **FR-019**: A session MUST end no later than 30 minutes after the last request that needs the account, and MUST NOT end earlier than 15 minutes after it. A session is never ended for inactivity while the user makes such requests less than 15 minutes apart.
- **FR-020**: When a visitor opens a page that needs login, the system MUST send them to the Log in page with the message "Log in to continue.", and remember that page as the "return to" page. When a signed-in user's session has ended, the message MUST instead be "Your session has expired. Log in again." No warning is shown before the session expires.
- **FR-021**: The system MUST provide an Account Suspended page with the main heading "Account suspended" and the text "Your account is suspended. Features that need an active account are blocked until an administrator reactivates it." The page is shown only to a signed-in Suspended user; anyone else who opens it is sent to the home page. A signed-in Suspended user sees only Home and Log out in the navigation.
- **FR-022**: The system MUST NOT show a password after it is entered, MUST NOT return it in any response and MUST NOT write it, or the entered email together with a failed password, to logs.
- **FR-023**: The Log in page MUST have a visible label for every field, link each error message to its field, and be usable by keyboard and screen reader.
- **FR-024**: The Log in and Account Suspended pages MUST work on desktop and mobile screens, down to 320 px wide, without horizontal scrolling.
- **FR-025**: Every page added by this feature MUST have exactly one main heading, a browser tab title in the form "<Page> - Spėk laiku" ("Log in - Spėk laiku", "Account suspended - Spėk laiku"), and a "Skip to main content" link as the first focusable item. The main heading of the Log in page is "Log in".
- **FR-026**: After 5 failed login attempts in a row for one account, the system MUST lock that account for login for 15 minutes. While it is locked, every login attempt for it, including one with the correct password, MUST be refused with "Error: Incorrect email or password.". A successful login MUST reset the count of failed attempts. The lock MUST NOT change the account's Active or Suspended status.
- **FR-027**: The system MUST write a log entry when an account is locked (FR-026), identifying the account only by its internal identifier, and when a login or logout fails for a technical reason (FR-014, FR-017). It MUST NOT log successful logins, failed logins or logouts, and no log entry may contain a password or an entered email.

### Key Entities

- **User Account** (from feature 001): email address (unique, case-insensitive), protected password, role (Registered User or Administrator) and status (Active or Suspended). This feature reads the account; it does not change it.
- **Session**: the signed-in state of one user in one browser. Starts at login or registration, ends at logout or after inactivity (FR-019).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A registered user who knows their details can log in from the Log in page in under 30 seconds.
- **SC-002**: 100% of login attempts with an unknown email or a wrong password show the same message and sign nobody in.
- **SC-003**: After login, 100% of Registered Users, Administrators and Suspended users land on the page defined for them in FR-010.
- **SC-004**: After logout, 0 pages or actions that need login can be reached without logging in again.
- **SC-005**: A password never appears in readable form on any screen, in any response or in any log.
- **SC-006**: Logging in and out can be completed using only the keyboard, and every field label and error is announced by a screen reader.
- **SC-007**: The Log in and Account Suspended pages fit a 320 px wide screen with no horizontal scrolling.
- **SC-008**: An account can receive at most 5 wrong-password attempts in any 15-minute lock period before further attempts are refused.

## Assumptions

- The session created at registration in feature 001 is the same kind of session this feature creates at login, so registration and login sign a user in the same way.
- There is no "Remember me" option. A session always ends within 30 minutes of inactivity (project NFR-016, FR-019).
- Password reset ("forgot password") and email confirmation are not needed in this version.
- Administrator and Suspended accounts are created or changed outside this feature (by the project owner, and later by feature 014). Tests set them up directly.
- Blocking a Suspended user from features that need an active account (the rest of FR-041) is applied by each of those features and by feature 014. This feature covers what happens at login and adds the Account Suspended page.
- No page in the application needs login yet. The "Log in to continue." redirect and the "return to" page are built now and are first used by later features (for example 010 Save and View Plans).
- The UX form table writes the empty-password message as "Enter password"; this specification uses "Error: Enter your password." to match the email message and the "Error:" rule.
- The interface uses one language.

## Dependencies

- Feature 001 User Registration (merged): user accounts, the sign-in session, the home page, the success banner, the error summary and the page layout with the skip link.
- Related UX material: Flow 2 (Login), Screen 3 (Log in), Form 2, section 6 (states for Log in and Account Suspended) and section 7 (navigation by role) of `docs/ux-design.md`.
- Features 010, 011, 014, 015 and 016 depend on this feature.

## Scope Boundaries

**In scope**: the Log in page, validation and messages, signing in, the destination after login by role, status and requested page, logging out, session expiry handling, the "Log in to continue." redirect, the Account Suspended page, and the Log in / Log out navigation items.

**Out of scope**: password reset, "Remember me", email confirmation, social sign-in, changing email or password, a warning before the session expires, a message that tells the user their account is locked, suspending or reactivating accounts (feature 014), the real Service status page (feature 015), keeping a visitor's plan after login (feature 010) and Access Denied / Not Found pages for other features.

## Traceability to project requirements

| Source                                         | Covered by                     |
| ---------------------------------------------- | ------------------------------ |
| FR-003 (log in with email and password)        | FR-001 to FR-009, FR-013 to FR-015, FR-026 |
| FR-004 (log out)                               | FR-016 to FR-018               |
| FR-040 (destination after login)               | FR-010 to FR-012               |
| FR-041 (suspended users told why they are blocked) | FR-010, FR-021             |
| NFR-006 (no credentials in logs)               | FR-022, FR-027                 |
| NFR-013 (announce loading and status)          | FR-007, FR-015, FR-017         |
| NFR-014 (heading, page title, skip link)       | FR-025                         |
| NFR-015 (errors next to the field)             | FR-005, FR-023                 |
| NFR-011 (desktop and mobile layout)            | FR-024                         |
| NFR-016 (30-minute inactivity limit)           | FR-019, FR-020                 |
| Constitution IV (server-side validation)       | FR-009                         |
| UX design section 6 (Log in states)            | FR-004, FR-013, FR-014         |
| UX design section 7 (navigation and redirects) | FR-010, FR-013, FR-016, FR-017, FR-020 |
| UX design section 9.4 (errors and summary)     | FR-007, FR-008                 |
