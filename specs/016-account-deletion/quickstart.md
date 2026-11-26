# Quickstart Validation Guide: 016-account-deletion

**Date**: 2026-11-26 | **Plan**: [plan.md](plan.md) | **Contract**: [contracts/account-deletion-api.md](contracts/account-deletion-api.md) | **Data model**: [data-model.md](data-model.md)

This guide proves the feature works. Part 1 runs the automated checks, which are the deterministic proof. Part 2 is the manual walkthrough for the Pull Request screenshots.

## Prerequisites

- The setup in the README ("Setup, run and test"): the .NET SDK, Node.js, and Docker for PostgreSQL and the integration tests.
- Branch `016-account-deletion`. There is **no migration**.
- For Part 2, register **new** throwaway accounts on the Register page. Deleting an account cannot be undone, so do not use the walkthrough accounts of earlier features (walkthrough-b, walkthrough-admin, walkthrough-suspended).
  - **E**: an Active Registered User with two saved plans.
  - **F**: an Active Registered User with one saved plan, for the wrong-password and lock checks.
  - **G**: an Active Registered User, suspended on the User accounts page, for scenario 6.
  - An **Active Administrator** (walkthrough-admin is fine: it is only used to suspend G and to open the Account page).
  - **External services**: plans need Open-Meteo and the map data service to be created. Saving them is the only step that calls them; the deletion itself calls no external service.

## Part 1: Automated checks

From `backend/`:

```powershell
dotnet build
dotnet test
dotnet format --verify-no-changes
```

From `frontend/`:

```powershell
npm run lint
npm run format:check
npm test
npm run build
```

The first `npm test` of a session can fail with "Failed to start forks worker". If it does, run it again before investigating.

Expected: everything passes, including the new and changed tests listed in [plan.md](plan.md), "Testing". The tests that prove the spec's success criteria:

| Criterion | Proven by |
|---|---|
| SC-002 (no plan or login survives) | `AccountDeletionEndpointTests`, `DeletedAccountSessionTests` |
| SC-003 (only the owner, with the password) | `AccountDeletionAuthorizationTests`, `AccountDeletionPasswordTests` |
| SC-004 (all or nothing) | `AccountDeletionAtomicityTests` |
| SC-005 (email registered again) | `DeletedAccountSessionTests` |
| SC-006 (keyboard and screen reader) | `keyboard.test.tsx`, `accessibility.test.tsx`, `AccountPage.test.tsx` |
| SC-007 (320 px) | `responsive.test.tsx`, and Part 2 scenario 8 |

## Part 2: Manual walkthrough

Start the database, the API and the frontend as in the README ("Run the application").

1. **Navigation and page** (User Story 2 scenario 1, FR-001, FR-013): log in as E. "Account" is in the navigation after "My plans". Open it. The tab title is "Account - Spėk laiku", the heading is "Account", the page shows E's email and the "Delete account" section with its warning. Press Tab once: "Skip to main content" is focused first.
2. **Cancel** (User Story 1 scenario 3): select "Delete account". The dialog asks the question with E's email, and focus is in the "Password" field. Press Escape: the dialog closes and focus is back on "Delete account". Open it again, type something, select "Cancel", and open it once more: the field is empty.
3. **Empty and wrong password** (scenarios 5 and 6): select "Delete account" in the dialog with the field empty: "Error: Enter your password." next to the field. Enter a wrong password: "Error: Password is incorrect.", the field is emptied and focused, the dialog stays open. Open My plans in another tab: E's plans are still there.
4. **Delete** (scenario 4): enter E's password and press Enter. "Deleting your account…" may flash. Home opens with the visitor navigation and "✓ Success: Your account has been deleted.". *Screenshot.*
5. **Afterwards** (scenarios 7 and 8, FR-005, FR-006):
   - In the other tab still on My plans, reload or open a plan: the Log in page opens with "Your session has expired. Log in again."
   - Log in with E's email and old password: "Error: Incorrect email or password."
   - Register again with E's email: it works, and My plans shows "No saved plans yet."
6. **Suspended and Administrator** (User Story 2 scenarios 4 and 5): as the administrator, suspend G on the User accounts page. Log in as G and open `/account`: the Account Suspended page opens and "Account" is not in the navigation. As the administrator, open `/account`: Access denied, and "Account" is not in the navigation. As a visitor, open `/account`: Log in with "Log in to continue.", and after logging in as F the Account page opens.
7. **Lock** (FR-016): as F, enter a wrong password five times in the dialog. The fifth shows "Error: Too many incorrect passwords. Try again in 15 minutes." and F is still signed in. Enter F's correct password: the same message, and F's plan is still there. In a private window, log in as F with the correct password: "Error: Incorrect email or password." (the shared lock). *Screenshot of the dialog.*
8. **Phone width** (FR-014): with the browser's device toolbar at 320 px, open the Account page and the dialog as F (after the lock ends, or as a new account). There is no horizontal scrolling, the field and buttons are full width, and a long email wraps. *Screenshot.*
9. **Server error** (scenario 10, FR-008): stop the API, enter a password and confirm. After at most 10 seconds "Error: Account could not be deleted. Try again." is shown with Retry. Start the API and select Retry: the account is deleted.
10. **Log** (FR-015): in the API console, the deletion in step 4 wrote "Account <id> deleted with 2 saved plans." with no email, and step 7 wrote the lock Warning with F's id only.

## Clean-up

Accounts E (re-registered), F and G are throwaway accounts. Delete them on the Account page, or leave them in the local database.
