# Feature Specification: Account Deletion

**Feature Branch**: `016-account-deletion`
**Created**: 2026-11-26
**Status**: Draft
**Input**: A signed-in Registered User deletes their own account and all their saved plans (project FR-005, FR-039 account deletion), from a new minimal Account page that shows the account email and a Delete account section and is linked from the navigation (a later Profile feature may extend it). Deletion asks for confirmation first, is permanent, signs the user out and ends their session, and afterwards the email can be registered again. Follow the screens, states, navigation, dialog and responsive rules in `docs/ux-design.md`. Out of scope: an administrator deleting a user's account (the deletion half of project FR-042 stays open, after the MVP), editing profile details or preferences, and data export.

## Clarifications

### Session 2026-11-26

- Q: Should an administrator also be able to delete user accounts in this feature? → A: No. Only a user deleting their own account. The deletion half of project FR-042 stays open, after the MVP.
- Q: Where does the user find "Delete account"? → A: On a new minimal Account page (email and the Delete account section), linked from the navigation. A later Profile feature may extend it.
- Q: Does the user re-enter their password before the account is deleted? → A: Yes. The confirmation dialog has a "Password" field, and the account is deleted only when the password is correct. Wrong passwords count towards the login lock of feature 002 (FR-002, FR-016).
- Q: May a suspended user delete their own account? → A: No. Deletion needs an active account, like every other feature that needs one. A suspended user who opens the Account page is sent to the Account Suspended page (FR-009, FR-011).
- Q: Should wrong passwords in the Delete account dialog count towards the same 5-try, 15-minute lock as Log in? → A: Yes, one counter per account. While the account is locked the dialog shows "Error: Too many incorrect passwords. Try again in 15 minutes.", the user stays signed in, and nothing is deleted (FR-016).
- Q: What are the new page and its navigation item called? → A: "Account". It takes the place of "Profile (Could Have)" in the navigation table of `docs/ux-design.md` section 7, which this feature updates (FR-001, FR-010, FR-013).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Delete my account and my plans (Priority: P1)

As a Registered User, I want to delete my account and all my saved plans after confirming it, so that my personal data is no longer kept when I stop using the application.

**Why this priority**: This is the whole feature (project FR-005). Today an account can only be removed by changing the database.

**Independent Test**: A signed-in Active Registered User with two saved plans opens the Account page, selects "Delete account", enters their password, confirms, and lands on Home as a visitor with a success message. Logging in with the old email and password then fails, and the same email can be used to register a new, empty account.

**Acceptance Scenarios**:

1. **Given** a signed-in Active Registered User, **When** they open the Account page, **Then** they see the main heading "Account", their email, and a "Delete account" section that explains "Deleting your account also deletes all your saved plans. This cannot be undone." with a "Delete account" button.
2. **Given** the Account page, **When** the user selects "Delete account", **Then** a dialog asks "Delete your account user@example.com? All your saved plans will be deleted. This cannot be undone." with a "Password" field and the buttons "Delete account" and "Cancel", and keyboard focus moves to the "Password" field.
3. **Given** the delete dialog, **When** the user selects "Cancel" or presses Escape, **Then** the dialog closes, nothing changes, and focus returns to the "Delete account" button that opened it.
4. **Given** the delete dialog, **When** the user enters their correct password and selects "Delete account" (or presses Enter in the field), **Then** the account and every plan saved under it are deleted, the user is signed out, plan data in the browser session is cleared, and Home opens with the visitor navigation and "✓ Success: Your account has been deleted." shown and announced.
5. **Given** the delete dialog, **When** the user selects "Delete account" with the "Password" field empty, **Then** "Enter your password." is shown next to the field, focus stays in the field, and nothing is sent or deleted.
6. **Given** the delete dialog, **When** the user enters a wrong password and selects "Delete account", **Then** "Password is incorrect." is shown next to the field, the field is emptied and focused, the dialog stays open, and nothing is deleted.
7. **Given** a deleted account, **When** anyone tries to log in with its email and old password, **Then** login fails with the same message as any wrong email or password (feature 002).
8. **Given** a deleted account, **When** someone registers with the same email, **Then** registration succeeds and the new account has no saved plans.
9. **Given** a confirmed deletion, **When** the server has not answered yet, **Then** "Deleting your account…" is shown and announced, and the dialog's field and buttons are disabled.
10. **Given** a confirmed deletion, **When** the server fails, does not answer within 10 seconds, or the network fails, **Then** "Error: Account could not be deleted. Try again." is shown with a Retry button, the user stays signed in on the Account page, and the account and all its plans are unchanged.

---

### User Story 2 - Only the account owner can delete the account (Priority: P1)

As the project owner, I want an account to be deletable only by its own signed-in owner, so that nobody can delete someone else's account or plans.

**Why this priority**: Business rule "A Registered User may access only their own private plans" and constitution principles III and IV (an authorization test for every protected operation, enforced on the server).

**Independent Test**: Send delete-account requests as a visitor, an Active Registered User, a Suspended user and an Active Administrator, each with the correct password, and check that only the Active Registered User succeeds, that they can delete only their own account, and that every other account and plan is unchanged.

**Acceptance Scenarios**:

1. **Given** a signed-in Active Registered User, **When** they look at the navigation, **Then** they see "Account" after "My plans", and selecting it opens the Account page.
2. **Given** a visitor, an Administrator or a Suspended user, **When** they look at the navigation, **Then** they do not see "Account".
3. **Given** a visitor, **When** they open the Account page address, **Then** they are sent to the Log in page with "Log in to continue.", and after logging in as an Active Registered User the Account page opens.
4. **Given** a signed-in Active Administrator, **When** they open the Account page address, **Then** the Access Denied page is shown.
5. **Given** a signed-in Suspended user, **When** they open the Account page address, **Then** they are sent to the Account Suspended page and nothing is deleted.
6. **Given** anyone who is not a signed-in Active Registered User, **When** they send a delete-account request directly to the server, **Then** the request is refused and nothing is deleted.
7. **Given** a signed-in Active Registered User, **When** they send a delete-account request, **Then** only their own account and their own plans are deleted; the request cannot name another account, and every other account and plan is unchanged.

---

### User Story 3 - Delete my account with keyboard, screen reader and on a phone (Priority: P2)

As a user who uses a keyboard, a screen reader or a phone, I want to delete my account in the same way as everyone else.

**Why this priority**: Accessibility and mobile use are project-wide requirements (NFR-004, NFR-011 to NFR-015), but the page works without them for most users.

**Independent Test**: A user opens the Account page and deletes their account using only the keyboard, and the page is usable on a 320 px wide screen without horizontal scrolling.

**Acceptance Scenarios**:

1. **Given** the Account page, **When** a user moves through it with the keyboard only, **Then** the "Delete account" button, the dialog's "Password" field and its buttons can be reached and used in a logical order.
2. **Given** the delete dialog, **When** it is open, **Then** Tab and Shift+Tab stay inside it, Escape closes it, and closing it returns focus to the button that opened it.
3. **Given** a success, pending or error message, **When** it appears, **Then** it is announced without moving focus, except where these scenarios say focus moves.
4. **Given** the Account page, **When** a keyboard user presses Tab once, **Then** the first focused item is "Skip to main content"; the page has exactly one main heading, "Account", and the browser tab title "Account - Spėk laiku".
5. **Given** a phone-sized screen, **When** the Account page or the dialog is open, **Then** the buttons and the "Password" field are full width, every button is at least 44 × 44 px, input text is at least 16 px, the email wraps instead of overflowing, and there is no horizontal scrolling down to 320 px.

### Edge Cases

- The "Delete account" button in the dialog is pressed twice quickly: one request is sent.
- Spaces around the entered password are kept, as on Log in; the password is checked exactly as entered.
- Five wrong passwords in a row (in the dialog, on Log in, or both): the account is locked for login for 15 minutes as in feature 002. While it is locked, the dialog refuses every password, including the correct one, with "Error: Too many incorrect passwords. Try again in 15 minutes." The user stays signed in, and nothing is deleted.
- The user closes the dialog after entering a password: the field is emptied, and the next time the dialog opens it is empty.
- The user has no saved plans: the account is deleted in the same way.
- The user has a plan in progress in the browser that is not saved: it is cleared with the rest of the session data, as on log out.
- The user is signed in to the same account in another browser or tab: after the deletion, that session's next request is refused and it is sent to the Log in page with "Your session has expired. Log in again."; no data of the deleted account is shown there.
- The user has a saved plan open in another tab: opening or changing it after the deletion is refused as in the previous case.
- The user's session expires while the Account page or dialog is open: on confirming they are sent to the Log in page with "Your session has expired. Log in again.", nothing is deleted, and after logging in they return to the Account page.
- The account is suspended by an administrator while the Account page or dialog is open: the deletion request is refused, nothing is deleted, and the user is sent to the Account Suspended page.
- A technical failure part-way through the deletion: nothing is deleted. The account is never left without its plans, and plans are never left without their account.
- The deletion succeeds but the answer does not reach the browser (for example the network fails): Retry is refused because the account no longer exists, and the user is sent to the Log in page with "Your session has expired. Log in again."; logging in with the old details fails as in User Story 1 scenario 5.
- An administrator's User accounts page was loaded before the deletion: acting on the deleted account shows "Error: This account no longer exists." (feature 014).

## Requirements _(mandatory)_

IDs in this specification are local to this feature. The related project requirements are listed in the traceability table at the end.

### Functional Requirements

- **FR-001**: The system MUST provide an Account page with the main heading "Account" that shows the signed-in user's email and a "Delete account" section with the text "Deleting your account also deletes all your saved plans. This cannot be undone." and a "Delete account" button. The page MUST NOT show or offer to change the password or any other account detail.
- **FR-002**: "Delete account" MUST open a confirmation dialog with the text "Delete your account <email>? All your saved plans will be deleted. This cannot be undone.", a password field labelled "Password", and the buttons "Delete account" and "Cancel". The account MUST be deleted only after "Delete account" in the dialog is selected (or Enter is pressed in the field) and the server has checked that the entered password is the account's current password. An empty field MUST show "Enter your password." next to it without sending anything; a wrong password MUST show "Password is incorrect." next to it, empty and focus the field, keep the dialog open and delete nothing. "Cancel" and Escape MUST close the dialog without a change and empty the field.
- **FR-003**: A confirmed deletion MUST permanently delete the account and every plan saved under it, all together or not at all. Nothing of the account or its plans MUST be kept in the application after the deletion.
- **FR-004**: After a successful deletion the system MUST end the user's session, clear plan data in the browser session as on log out, open Home with the visitor navigation, and show and announce "✓ Success: Your account has been deleted."
- **FR-005**: After a deletion, every other session of the deleted account MUST be refused on its next request and treated as an expired session ("Your session has expired. Log in again."), and logging in with the deleted account's email and password MUST fail with the same message as any wrong email or password.
- **FR-006**: After a deletion, the deleted account's email MUST be available for a new registration (feature 001). A new account with that email MUST have no saved plans and nothing else from the deleted account.
- **FR-007**: While a deletion is in progress, the system MUST show and announce "Deleting your account…" without moving focus, and disable the dialog's field and buttons. A second press while one is in progress MUST be ignored.
- **FR-008**: If a deletion fails for a technical reason, takes more than 10 seconds, or the network fails, the system MUST show "Error: Account could not be deleted. Try again." in the dialog with a Retry button that sends the same request again, keep the user signed in, and show no technical details. Every error message, including the messages next to the field, MUST start with "Error:", added by the frontend, and the messages next to the field MUST be linked to it for assistive technology (changed during planning, research section 9).
- **FR-009**: Only a signed-in Active Registered User may delete an account through this feature, and only their own. The request MUST NOT name an account; the server MUST delete the account of the signed-in user who sent it. A Suspended user MUST be refused as for every other feature that needs an active account (feature 014). The server MUST refuse the request from anyone else, whatever the browser shows, and delete nothing, and MUST refuse it without the correct password even from the account's owner.
- **FR-010**: The system MUST show "Account" in the navigation only to a signed-in Active Registered User, after "My plans", linking to the Account page.
- **FR-011**: A visitor who opens the Account page MUST be sent to the Log in page with "Log in to continue." and returned to it after logging in. A signed-in Suspended user MUST be sent to the Account Suspended page. A signed-in Active Administrator MUST see the Access Denied page (feature 003).
- **FR-012**: The delete dialog MUST move focus inside it when it opens, keep Tab and Shift+Tab inside it, close with Escape, and return focus to the button that opened it when it closes without a change.
- **FR-013**: The Account page MUST have exactly one main heading, the browser tab title "Account - Spėk laiku" and a "Skip to main content" link as the first focusable item, and MUST be usable by keyboard and screen reader.
- **FR-014**: On screens down to 320 px wide the Account page and the dialog MUST have a full-width "Password" field with input text of at least 16 px, full-width buttons of at least 44 × 44 px, wrap a long email instead of overflowing, and have no horizontal scrolling.
- **FR-015**: The system MUST write a log entry for each successful account deletion, naming the action, the deleted account's id and the number of plans deleted, and MUST NOT write the email or any password to the log. A technical failure while deleting MUST also be logged. Wrong passwords in the dialog are not logged, except a resulting lock, which is logged as in feature 002.
- **FR-016**: A wrong password in the delete dialog MUST count as a failed attempt towards the login lock of feature 002 (5 in a row lock the account for login for 15 minutes). While the account is locked, the dialog MUST refuse every password, including the correct one, with "Error: Too many incorrect passwords. Try again in 15 minutes.", keep the user signed in and delete nothing.

### Key Entities

- **User Account** (from features 001 and 002): a person's sign-in account. This feature reads its email, role and status, checks the entered password against it, counts wrong passwords towards its login lock (feature 002), and deletes the whole account. The password is never shown or returned.
- **Saved Plan** (from feature 010): belongs to one account. All plans of the deleted account are deleted with it.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A signed-in user can delete their account from Home, including opening the Account page, entering their password and confirming, in under 1 minute.
- **SC-002**: After a deletion, 0 of the deleted account's plans can be opened, listed or changed by anyone, and 0 login attempts with the deleted account's details succeed.
- **SC-003**: 100% of delete-account attempts by anyone other than a signed-in Active Registered User, or without the account's correct password, are refused, whether made through the page or directly to the server, and 100% of successful deletions leave every other account and its plans unchanged.
- **SC-004**: 100% of deletions that fail part-way leave the account and all its plans exactly as before.
- **SC-005**: The email of a deleted account can be registered again at once.
- **SC-006**: Deleting an account can be completed using only the keyboard, and the button, the dialog and every message are announced by a screen reader.
- **SC-007**: The Account page and its dialog fit a 320 px wide screen with no horizontal scrolling.

## Assumptions

- The Account page is a minimal page with the email and the Delete account section only. It takes the "Profile (Could Have)" place in the navigation table of `docs/ux-design.md` section 7 under the name "Account"; a later Profile feature may add profile details and preferences to it. The UX document is updated in this feature to say so.
- Only Registered User accounts are deleted here, as project FR-005 says. Administrators do not see "Account" and get Access Denied on the page, which also prevents the last administrator from deleting themselves. Administrator accounts are still created and removed outside the application, as in features 002, 003 and 014.
- Deletion is immediate and permanent: there is no grace period, no "undo", no email confirmation and no copy kept in the application. The UX confirmation text "This cannot be undone." is shown before it.
- The password re-entry goes beyond the UX confirmation ("the same style for delete") because deleting an account cannot be undone and an unlocked, signed-in computer should not be enough to do it. Sharing the login lock keeps one limit on password guessing for each account. Unlike Log in, the dialog may say that the account is locked, because the user is already signed in to it.
- Copies in database backups, if any exist outside the application, are not part of this feature.
- The project has no other data that belongs to a user besides the account and its saved plans (shared plans, voting and custom activities are not built). If such data is added later, its feature must delete it with the account.
- Blocking requests from a session whose account no longer exists is already done by features 002 and 014: the server reads the account on every request. This feature's tests prove it for a deleted account.
- An administrator deleting a user's account (the deletion half of project FR-042) is still open, after the MVP, with no feature number. No Delete button is added to the User accounts page.
- The interface uses one language.

## Dependencies

- Feature 001 User Registration (merged): registering again with the email of a deleted account.
- Feature 002 User Login and Logout (merged): sign-in, the account's role and status, log out behaviour (clearing plan data in the session), the "Log in to continue." and "Your session has expired. Log in again." redirects, and the signed-in navigation.
- Feature 003 Activity Category Management (merged): the Access Denied page.
- Feature 010 Save and View Plans (merged): saved plans, which are deleted with the account.
- Feature 011 Plan Management (merged): the confirmation dialog pattern (focus trap, Escape, focus return) and the pending, error and Retry pattern for a delete.
- Feature 014 Administrator Account Access Management (merged): account status, the Account Suspended page, and the "This account no longer exists." message on the User accounts page.
- Related UX material: the Profile screen in section 1, the confirmation states in section 6 ("the same style for delete"), section 7 (navigation by role and redirects) and the accessibility rules for dialogs in `docs/ux-design.md`.

## Scope Boundaries

**In scope**: the Account page with the email and the Delete account section; the confirmation dialog; deleting the account and all its plans together; signing the user out and clearing session plan data; refusing the deleted account's other sessions and old login details; making the email available again; the server rule that only the signed-in owner deletes their own account; the "Account" navigation item; and log entries for deletions.

**Out of scope**: an administrator deleting a user's account (after the MVP); deleting Administrator accounts; editing the email, password, profile details or preferences; a password reset; exporting the user's data before deletion; a grace period, undo or deletion email; and removing copies from backups outside the application.

## Traceability to project requirements

| Source                                                                     | Covered by                       |
| -------------------------------------------------------------------------- | -------------------------------- |
| FR-005 (a Registered User deletes their own account)                       | FR-001, FR-003 to FR-009, FR-011 |
| FR-039 (confirmation before an account is deleted)                         | FR-002, FR-012, FR-016           |
| FR-042 (an Administrator deletes accounts)                                 | Not covered; after the MVP       |
| Business rule: a Registered User may access only their own private plans  | FR-003, FR-009                   |
| Business rule: a suspended user may not use features that need an active account | FR-009, FR-011            |
| NFR-004 (keyboard use)                                                     | FR-012, FR-013                   |
| NFR-006 (no credentials in logs)                                           | FR-015                           |
| NFR-011 (desktop and mobile layout)                                        | FR-014                           |
| NFR-013 (announce loading and status)                                      | FR-004, FR-007, FR-008           |
| NFR-014 (heading, page title, skip link)                                   | FR-013                           |
| NFR-015 (validation messages next to the field)                            | FR-002, FR-008                   |
| Constitution III (authorization test for each protected operation)        | FR-009                           |
| Constitution IV (server-side authorization, no secrets in logs)           | FR-009, FR-015, FR-016           |
| UX design section 6 (confirmation "the same style for delete")            | FR-002                           |
| UX design section 7 (navigation by role and redirects)                    | FR-010, FR-011                   |
