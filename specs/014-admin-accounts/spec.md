# Feature Specification: Administrator Account Access Management

**Feature Branch**: `014-admin-accounts`
**Created**: 2026-11-25
**Status**: Draft
**Input**: An administrator sees the user accounts and suspends and reactivates Registered User accounts, and a suspended user is blocked from features that need an active account (project FR-029, FR-031, FR-039 account suspension, FR-041, FR-042 reactivation), following the Admin: User Accounts screen, its states and the navigation, dialog and responsive rules in `docs/ux-design.md`. Account deletion is a Should Have capability left for after the MVP (`docs/architecture.md` section 6).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Suspend a Registered User account (Priority: P1)

As an administrator, I want to suspend a Registered User account after confirming it, so that a person who misuses the application loses access until the account is reactivated.

**Why this priority**: Suspension is the core of this feature (project FR-029) and the only Must Have capability left for the MVP. Today an account can only be suspended by changing the database.

**Independent Test**: An Active Administrator opens the User accounts page, selects "Suspend" on an Active Registered User, confirms, and sees the account's status change to Suspended. The suspended user's next page load opens the Account Suspended page.

**Acceptance Scenarios**:

1. **Given** an Active Administrator, **When** they open the User accounts page, **Then** they see the accounts with each one's email, role, status and registration date, and a "Suspend" button on every Active Registered User account.
2. **Given** the User accounts page, **When** the administrator selects "Suspend" on the account "user@example.com", **Then** a dialog asks "Suspend user@example.com? They will lose access until reactivated." with "Suspend" and "Cancel", and keyboard focus moves into the dialog.
3. **Given** the suspend dialog, **When** the administrator selects "Cancel" or presses Escape, **Then** the dialog closes, nothing changes, and focus returns to the "Suspend" button that opened it.
4. **Given** the suspend dialog, **When** the administrator selects "Suspend", **Then** the account is suspended, "✓ Success: Account suspended." is shown and announced, the account's status shows "Suspended", and its button becomes "Reactivate" and receives focus.
5. **Given** a user whose account was just suspended and who is still signed in, **When** they load any page or use any feature that needs an active account, **Then** they are sent to the Account Suspended page, which explains why access is blocked, and the action is not performed.
6. **Given** a suspended user, **When** they log in, **Then** they land on the Account Suspended page (feature 002).
7. **Given** a confirmed suspension, **When** the server has not answered yet, **Then** "Suspending account…" is shown and announced, and that account's buttons are disabled.
8. **Given** a confirmed suspension, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Account could not be suspended. Try again." is shown with a Retry button, the account's status is unchanged in the list, and Retry sends the same request again.

---

### User Story 2 - Reactivate a suspended account (Priority: P1)

As an administrator, I want to reactivate a suspended Registered User account, so that the person can use the application again with their saved plans intact.

**Why this priority**: Without reactivation a suspension made by mistake could only be undone in the database (project FR-042, reactivation).

**Independent Test**: An Active Administrator selects "Reactivate" on a suspended Registered User. The user can then open My plans and sees the same plans as before the suspension.

**Acceptance Scenarios**:

1. **Given** a suspended Registered User account on the User accounts page, **When** the administrator selects "Reactivate", **Then** the account becomes Active at once without a confirmation, "✓ Success: Account reactivated." is shown and announced, the status shows "Active", and its button becomes "Suspend" and receives focus.
2. **Given** a reactivated user, **When** they next load a page, or log in, **Then** they have the same access as before the suspension and see every plan they had saved before it, unchanged.
3. **Given** a reactivation, **When** the server has not answered yet, **Then** "Reactivating account…" is shown and announced, and that account's buttons are disabled.
4. **Given** a reactivation, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Account could not be reactivated. Try again." is shown with a Retry button and the account's status is unchanged in the list.

---

### User Story 3 - Find an account (Priority: P2)

As an administrator, I want to find an account by its email, so that I can act on the right person without reading through every account.

**Why this priority**: The page is usable with a short list, but the number of accounts grows over time and the UX design includes a search ("No accounts match your search.").

**Independent Test**: With more accounts than fit on the page, an administrator enters part of an email and sees only the matching accounts.

**Acceptance Scenarios**:

1. **Given** the User accounts page, **When** it opens, **Then** the accounts are listed newest registration first, at most 50 at a time.
2. **Given** more than 50 accounts, **When** the page shows the first 50, **Then** it also shows "Showing the 50 most recently registered accounts. Search by email to find others."
3. **Given** the search field "Search by email", **When** the administrator enters "ana" and selects "Search" (or presses Enter), **Then** only accounts whose email contains "ana", in any letter case, are listed, newest first, at most 50.
4. **Given** a search with no matching account, **When** the result is shown, **Then** the page shows "No accounts match your search." and a "Clear search" button.
5. **Given** a search result, **When** the administrator selects "Clear search", **Then** the search field is emptied and the full list is shown again.
6. **Given** the list is loading, **When** the server has not answered yet, **Then** "Loading accounts…" is shown and announced (never a spinner alone).
7. **Given** the list is loading, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Accounts could not be loaded." is shown with a Retry button.

---

### User Story 4 - Only active administrators can manage accounts (Priority: P1)

As the project owner, I want only active administrators to see and change account status, and never to see passwords, so that account control and personal data are protected.

**Why this priority**: Business rule "Only an Administrator may suspend or reactivate a Registered User account", project FR-031 and constitution principles III and IV (an authorization test for every protected operation, enforced on the server).

**Independent Test**: Open the User accounts page and send list, suspend and reactivate requests as a visitor, an Active Registered User, a Suspended user and an Active Administrator, and check that only the Active Administrator succeeds and that no answer contains a password or other sign-in secret.

**Acceptance Scenarios**:

1. **Given** a signed-in Active Administrator, **When** they look at the navigation, **Then** they see "Users", and selecting it opens the User accounts page.
2. **Given** a visitor, a Registered User or a Suspended user, **When** they look at the navigation, **Then** they do not see "Users".
3. **Given** a visitor, **When** they open the User accounts page address, **Then** they are sent to the Log in page with "Log in to continue.", and after logging in as an Active Administrator the User accounts page opens.
4. **Given** a signed-in Active Registered User, **When** they open the User accounts page address, **Then** the Access Denied page is shown and no account data is shown.
5. **Given** a signed-in Suspended user (Registered User or Administrator), **When** they open the User accounts page address, **Then** they are sent to the Account Suspended page.
6. **Given** anyone who is not a signed-in Active Administrator, **When** they send a request to list, suspend or reactivate accounts directly to the server, **Then** the request is refused, no account data is returned and nothing changes.
7. **Given** an Active Administrator, **When** the account list is shown or returned by the server, **Then** it contains only each account's identifier, email, role, status and registration date, and never a password, a password hash or any other sign-in secret.
8. **Given** an Active Administrator, **When** they send a suspend or reactivate request for an Administrator account, including their own, **Then** the request is refused and nothing changes.

---

### User Story 5 - Manage accounts with keyboard, screen reader and on a phone (Priority: P2)

As an administrator who uses a keyboard, a screen reader or a phone, I want to manage accounts in the same way as everyone else.

**Why this priority**: Accessibility and mobile use are project-wide requirements (NFR-004, NFR-011 to NFR-015), but the page works without them for most administrators.

**Independent Test**: An administrator searches, suspends and reactivates an account using only the keyboard, and the page is usable on a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the User accounts page, **When** an administrator moves through it with the keyboard only, **Then** the search field, every button and the dialog can be reached and used in a logical order.
2. **Given** the suspend dialog, **When** it is open, **Then** Tab and Shift+Tab stay inside it, Escape closes it, and closing it returns focus to the button that opened it.
3. **Given** a screen reader, **When** the administrator reaches an account's button, **Then** it is read with the account's email, for example "Suspend user@example.com" or "Reactivate user@example.com".
4. **Given** a success, pending or error message, **When** it appears, **Then** it is announced without moving focus, except where these scenarios say focus moves.
5. **Given** a desktop screen, **When** the page is open, **Then** the accounts are shown as a table; **Given** a phone-sized screen, **Then** each account is a card with its email, role, status as a word and registration date, and its button below them, full width, at least 44 × 44 px, with input text of at least 16 px and no horizontal scrolling down to 320 px.
6. **Given** the User accounts page, **When** a keyboard user presses Tab once, **Then** the first focused item is "Skip to main content"; the page has exactly one main heading, "User accounts", and the browser tab title "User accounts - Spėk laiku".

### Edge Cases

- Two administrators suspend the same account at about the same time: the account is suspended once and both see it as Suspended with "✓ Success: Account suspended.". The same applies to reactivation.
- An administrator acts on an account whose status was changed by another administrator after the list was loaded (for example selects "Suspend" on an account that is already suspended): the request succeeds without changing anything, and the list shows the account's current status.
- An administrator acts on an account that no longer exists: "Error: This account no longer exists." is shown and the list is loaded again.
- An administrator acts on an account whose role was changed to Administrator after the list was loaded: the request is refused with "Error: Administrator accounts cannot be suspended or reactivated here." and the list is loaded again.
- A suspended Administrator account: it is listed with its Suspended status and no button.
- The administrator's own account: it is listed like any other Administrator account, with no button.
- A suspended user has a plan in progress in their browser: the next request that needs an active account sends them to the Account Suspended page; the plan in progress is not saved.
- A suspended user opens Home or the Account Suspended page: these stay available (feature 002). They can log out.
- The administrator is suspended by changing the database while the User accounts page is open: their next request is refused and they are sent to the Account Suspended page.
- The administrator's session expires while the page is open: on their next action they are sent to the Log in page with "Your session has expired. Log in again." and return to the User accounts page after logging in.
- The "Suspend" button in the dialog or a "Reactivate" button is pressed twice quickly: one request is sent.
- While a suspend or reactivate request for one account is in progress, the buttons of every account are disabled, so only one change runs at a time.
- A search with spaces around the text: the spaces are removed before searching. An empty search shows the full list.
- A search text longer than 256 characters: refused by the server with "Error: Search text can be at most 256 characters." shown next to the field, and the list shown before the search is kept.
- The account list or a search answers while the administrator has started another search: only the answer to the latest search is shown.

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST provide a User accounts page with the main heading "User accounts" that lists accounts newest registration first, showing each account's email, role ("Registered User" or "Administrator"), status as a word ("Active" or "Suspended") and registration date. The server MUST return only these four values and an account identifier for each account, which the page uses to name the account in a change. It MUST list at most 50 accounts at a time and, when more match, show "Showing the 50 most recently registered accounts. Search by email to find others."
- **FR-002**: The system MUST offer a search field labelled "Search by email" with a "Search" button, also run by Enter. It MUST list only accounts whose email contains the entered text, ignoring letter case and spaces around the text, with the order and limit of FR-001. An empty search MUST list all accounts. Text longer than 256 characters MUST be refused with "Search text can be at most 256 characters." next to the field. When no account matches, the page MUST show "No accounts match your search." and a "Clear search" button that empties the field and shows the full list.
- **FR-003**: The system MUST show a "Suspend" button on each Active Registered User account and a "Reactivate" button on each Suspended Registered User account. Administrator accounts, including the signed-in administrator's own account and suspended Administrator accounts, MUST be listed with no button. Each button's accessible name MUST include the account's email ("Suspend user@example.com").
- **FR-004**: "Suspend" MUST open a confirmation dialog with the text "Suspend <email>? They will lose access until reactivated." and the buttons "Suspend" and "Cancel". The account MUST be suspended only after "Suspend" in the dialog is selected. "Cancel" and Escape MUST close the dialog without a change.
- **FR-005**: "Reactivate" MUST reactivate the account at once, without a confirmation.
- **FR-006**: After a successful suspension or reactivation, the system MUST show and announce "✓ Success: Account suspended." or "✓ Success: Account reactivated.", show the account's new status and button in the list without reloading the page, and move focus to the account's new button.
- **FR-007**: Only Registered User accounts MAY be suspended or reactivated through this feature. The server MUST refuse a suspend or reactivate request for an Administrator account, including the administrator's own, with "Administrator accounts cannot be suspended or reactivated here.", and change nothing.
- **FR-008**: Suspending an account that is already suspended, or reactivating one that is already active, MUST succeed without a change and answer with the account's current status. A request for an account that does not exist MUST be refused with "This account no longer exists.", and the page MUST then load the list again.
- **FR-009**: A suspension MUST take effect on the suspended user's next request, without waiting for them to log out or for their session to end. From then on, every feature that needs an active account MUST refuse them and send them to the Account Suspended page, which explains that the account is suspended and that features needing an active account are blocked (feature 002). Home, the Account Suspended page and Log out MUST stay available to them.
- **FR-010**: Suspending or reactivating an account MUST NOT change or delete the account's email, password, role, registration date or saved plans. After reactivation the user MUST have the same access and the same saved plans as before the suspension.
- **FR-011**: The system MUST NOT show or return any account's password, password hash or other sign-in secret to an administrator, in the page or in any server answer. The page MUST NOT offer to view, set or reset a password.
- **FR-012**: While the list or a search is loading, the system MUST show and announce "Loading accounts…" (never a spinner alone). If it fails, takes more than 10 seconds, or the network fails, it MUST show "Error: Accounts could not be loaded." with a Retry button. When several searches overlap, only the answer to the latest one MUST be shown.
- **FR-013**: While a suspension or reactivation is in progress, the system MUST show and announce "Suspending account…" or "Reactivating account…" without moving focus, and disable the buttons of every account. If it fails for a technical reason, takes more than 10 seconds, or the network fails, the system MUST show "Error: Account could not be suspended. Try again." or "Error: Account could not be reactivated. Try again." with a Retry button that sends the same request again, keep the account's previous status in the list and show no technical details. A second press while one is in progress MUST be ignored.
- **FR-014**: Every error message on the page MUST start with "Error:", added by the frontend, and validation errors MUST be shown as text next to the field, linked to it for assistive technology.
- **FR-015**: Only a signed-in Active Administrator may list, search, suspend or reactivate accounts through this feature. The server MUST refuse every such request from anyone else, whatever the browser shows, and return no account data.
- **FR-016**: The system MUST show "Users" in the navigation only to a signed-in Active Administrator, after "Categories", linking to the User accounts page.
- **FR-017**: A visitor who opens the User accounts page MUST be sent to the Log in page with "Log in to continue." and returned to it after logging in. A signed-in Suspended user MUST be sent to the Account Suspended page. A signed-in Active user who is not an Administrator MUST see the Access Denied page (feature 003).
- **FR-018**: The suspend dialog MUST move focus inside it when it opens, keep Tab and Shift+Tab inside it, close with Escape, and return focus to the button that opened it when it closes without a change.
- **FR-019**: The User accounts page MUST have exactly one main heading, the browser tab title "User accounts - Spėk laiku" and a "Skip to main content" link as the first focusable item, and MUST be usable by keyboard and screen reader.
- **FR-020**: The User accounts page MUST show the accounts as a table on desktop and as cards on screens down to 320 px wide, each card with the email, role, status as a word and registration date and its button below them. On narrow screens buttons and the search field MUST be full width, every button at least 44 × 44 px, input text at least 16 px, and there MUST be no horizontal scrolling.
- **FR-021**: The system MUST write a log entry for each successful suspension and reactivation, naming the action, the administrator's account id and the affected account's id, and MUST NOT write either account's email or any password to the log. A technical failure while changing the status MUST also be logged. No status history is kept in the application.

### Key Entities

- **User Account** (from features 001 and 002): a person's sign-in account. This feature reads its identifier, email, role (Registered User or Administrator), status (Active or Suspended) and registration date, and changes only the status of Registered User accounts. Its password and other sign-in secrets are never read for display or returned.
- **Saved Plan** (from feature 010): belongs to one account. Not read, changed or deleted by this feature; kept unchanged through a suspension and reactivation.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An administrator can find an account by its email and suspend it, including the confirmation, in under 1 minute.
- **SC-002**: 100% of a suspended user's requests to features that need an active account, made after the suspension, are refused, starting with the first request after it, with no need for them to log out.
- **SC-003**: 100% of attempts to list, search, suspend or reactivate accounts by anyone other than an Active Administrator are refused, whether made through the page or directly to the server, and 100% of attempts to suspend or reactivate an Administrator account are refused.
- **SC-004**: 0 answers shown or returned to an administrator contain a password, a password hash or any other sign-in secret.
- **SC-005**: After a suspension and reactivation, 100% of the user's saved plans are still there, unchanged.
- **SC-006**: Searching, suspending and reactivating can be completed using only the keyboard, and every button, message and the dialog are announced by a screen reader.
- **SC-007**: The User accounts page fits a 320 px wide screen with no horizontal scrolling.

## Assumptions

- Only Registered User accounts are suspended or reactivated here, as project FR-029 and the business rule say. This also means an administrator cannot suspend their own account and lock themselves out. Administrator accounts are still created, promoted, suspended and restored outside the application, as in features 002 and 003 (README "Testing an Administrator or Suspended account").
- Account deletion (the other half of project FR-042) is a Should Have capability left for after the MVP (`docs/architecture.md` section 6). No Delete button is shown, and the UX's delete confirmation is not part of this feature. A user deleting their own account is feature 016.
- Blocking a suspended user (project FR-041) is already done by features 002 to 012: the server reads the account's role and status on every request, and the Account Suspended page exists. This feature adds the way to change the status, and its tests prove that a status change made through the page takes effect on the next request.
- A suspension has no reason, end date or message to the user, and no email is sent. The Account Suspended page text stays as in feature 002.
- Reactivation needs no confirmation because it only restores access; project FR-039 asks for confirmation before suspension only.
- The administrator's landing page after login stays the home page until feature 015 adds Service status.
- The 50-account limit with a search, instead of paging, keeps the page simple. The project's expected number of accounts is small, and the newest accounts are the most likely to need attention.
- The registration date is shown as a date only, in the format already used for dates on other pages, in Lithuanian time as every date in the app (changed during planning, research section 13).
- The interface uses one language.

## Dependencies

- Feature 002 User Login and Logout (merged): sign-in, the account's role and status, the "Log in to continue." redirect with return to the requested page, the Account Suspended page, and the signed-in navigation.
- Feature 003 Activity Category Management (merged): the Active Administrator rule on the server and in the browser, the Access Denied page, and the "Categories" navigation item that "Users" follows.
- Feature 011 Plan Management (merged): the confirmation dialog pattern (focus trap, Escape, focus return) and the row action and card layout of My plans.
- Feature 010 Save and View Plans (merged): saved plans, which must survive a suspension and reactivation.
- Related UX material: the Admin: User Accounts screen in section 3, its states in section 6 (Empty and Confirmation), section 7 (navigation by role and redirects), section 8 (tables become cards with the status as a word) and the accessibility rules for dialogs and button names in `docs/ux-design.md`.

## Scope Boundaries

**In scope**: the User accounts page with its list, email search, 50-account limit, suspend with confirmation and reactivate; the server rules for who may do this and which accounts may be changed; never showing passwords; proving that a suspension blocks the user on their next request and that reactivation restores the same access and plans; the "Users" navigation item; and log entries for status changes.

**Out of scope**: deleting accounts (after the MVP) and a user deleting their own account (feature 016); suspending, reactivating, promoting or demoting Administrator accounts; creating accounts or changing an account's email, role or password; password resets; a reason, end date or notification for a suspension; a status history or audit page in the application; paging, sorting or filters other than the email search; showing a user's plans or plan counts to the administrator; and the Service status page and the administrator landing page (feature 015).

## Traceability to project requirements

| Source                                                         | Covered by                               |
| -------------------------------------------------------------- | ---------------------------------------- |
| FR-029 (an Administrator suspends a Registered User account)   | FR-001 to FR-004, FR-006 to FR-008, FR-013 |
| FR-031 (no passwords shown to an Administrator)                | FR-011                                   |
| FR-039 (confirmation before an account is suspended)           | FR-004, FR-018                           |
| FR-041 (suspended users blocked, with the reason)              | FR-009                                   |
| FR-042 (reactivate accounts; deletion after the MVP)           | FR-003, FR-005, FR-006, FR-010, FR-013   |
| Business rule: only an Administrator suspends or reactivates a Registered User account | FR-007, FR-015 to FR-017 |
| Business rule: a suspended user may not use features that need an active account | FR-009 |
| NFR-004 (keyboard use)                                         | FR-018, FR-019                           |
| NFR-011 (desktop and mobile layout)                            | FR-020                                   |
| NFR-013 (announce loading and status)                          | FR-006, FR-012, FR-013                   |
| NFR-014 (heading, page title, skip link)                       | FR-019                                   |
| NFR-015 (validation messages next to the field)                | FR-002, FR-014                           |
| Constitution III (authorization test for each protected operation) | FR-007, FR-015                       |
| Constitution IV (server-side authorization, no secrets in logs) | FR-011, FR-015, FR-021                  |
| UX design section 6 (Admin: User Accounts Empty and Confirmation states) | FR-002, FR-004                 |
| UX design section 7 (navigation by role and redirects)         | FR-016, FR-017                           |
| UX design section 8 (tables become cards with the status as a word) | FR-020                              |
