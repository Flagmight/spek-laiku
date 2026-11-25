# Quickstart Validation Guide: 014-admin-accounts

**Date**: 2026-11-25 | **Plan**: [plan.md](plan.md) | **Contract**: [contracts/admin-accounts-api.md](contracts/admin-accounts-api.md) | **Data model**: [data-model.md](data-model.md)

This guide proves the feature works. Part 1 runs the automated checks, which are the deterministic proof. Part 2 is the manual walkthrough for the Pull Request screenshots.

## Prerequisites

- The setup in the README ("Setup, run and test"): the .NET SDK, Node.js, and Docker for PostgreSQL and the integration tests.
- Branch `014-admin-accounts`. There is **no migration**, so `dotnet ef database update` is only needed if the local database is older than feature 011.
- For Part 2:
  - **Active Administrator**: one account. Promote a registered account with the README's SQL ("Testing an Administrator or Suspended account"). This feature does not change roles.
  - **Registered Users**: two Active Registered User accounts, C and D. C has at least one saved plan.
  - **Suspended Administrator**: one account, for the access check in scenario 5.
  - **External services**: none are needed. This feature calls neither Open-Meteo nor Overpass.

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
| SC-002: blocked on the next request | `AccountSuspensionEffectTests` |
| SC-003: only Active Administrators; Administrator accounts refused | `AdminAccountsAuthorizationTests`, `AdminAccountStatusEndpointTests` |
| SC-004: no sign-in secrets | `AdminAccountMappingTests` (exact JSON properties), `AdminAccountsListEndpointTests` |
| SC-005: plans unchanged | `AccountSuspensionEffectTests` |
| SC-006, SC-007: keyboard, screen reader, 320 px | `UserAccountsPage.test.tsx`, `accessibility.test.tsx`, `keyboard.test.tsx`, `responsive.test.tsx` |

## Part 2: Manual walkthrough

Start the database, the API and the frontend as in the README ("Run the application"), and log in as the Active Administrator.

### 1. Find an account (spec User Story 3)

1. Select **Users** in the navigation. It comes after **Categories**.
2. Enter part of C's email in **Search by email** and press Enter.
3. Search for `no-such-account`, then select **Clear search**.

Expected:
- **Step 1**:
  - The "User accounts" page lists accounts newest first, each with email, role, status and registration date. The tab title is "User accounts - Spėk laiku".
  - Registered User accounts have **Suspend** or **Reactivate**. Administrator accounts, including your own, have no button.
- **Step 2**: only matching accounts are listed.
- **Step 3**: "No accounts match your search." with **Clear search**, which brings back the full list.

**Screenshot**: the list at desktop width.

### 2. Suspend (spec User Story 1)

1. Sign in as C in a second browser (or a private window) and open **My plans**.
2. As the administrator, select **Suspend** on C, then **Cancel**. Select **Suspend** again, then **Suspend** in the dialog.
3. As C, reload **My plans**, or select any link.

Expected:
- **Step 2**:
  - The dialog reads "Suspend <C's email>? They will lose access until reactivated." with focus inside it.
  - **Cancel** changes nothing and returns focus to **Suspend**.
  - After confirming: "✓ Success: Account suspended.", C shows "Suspended" and has **Reactivate**, which has focus.
- **Step 3**: C is sent to the Account Suspended page. C did not have to log out first.

**Screenshots**: the dialog, and the list after the suspension.

### 3. Reactivate (spec User Story 2)

1. As the administrator, select **Reactivate** on C.
2. As C, reload the page and open **My plans**.

Expected:
- **Step 1**: no dialog. "✓ Success: Account reactivated." is shown, C shows "Active", and **Suspend** has focus.
- **Step 2**: C has normal access, and every saved plan is there, unchanged.

### 4. Errors (spec User Stories 1 and 2, edge cases)

1. Stop the API, then select **Suspend** on D and confirm.
2. Start the API again and select **Retry**.

Expected:
- **Step 1**: "Error: Account could not be suspended. Try again." with **Retry**. D's status is unchanged in the list.
- **Step 2**: D is suspended. Reactivate D afterwards.

### 5. Access (spec User Story 4)

1. Log out and open `/admin/users`. Expected: Log in with "Log in to continue.". After logging in as the administrator, the User accounts page opens.
2. As D, a Registered User, open `/admin/users`. Expected: Access denied, no **Users** link, and no account data.
3. As the Suspended Administrator, open `/admin/users`. Expected: the Account Suspended page.
4. In the browser's network tab, check that the list answer has only `id`, `email`, `role`, `accountStatus` and `registrationDate` for each account.

### 6. Log entries (spec FR-021)

In the API's console, the suspension and reactivation of steps 2 and 3 appear as "Account <id> suspended by administrator <id>." and "… reactivated …", with no email.

### 7. Phone, keyboard and screen reader (spec User Story 5)

1. Narrow the browser to 320 px. Expected: each account is a card with its status as a word and a full-width button, and nothing scrolls sideways.
2. With the keyboard only and NVDA on Windows, repeat scenarios 1 to 3. Expected:
   - The buttons are read as "Suspend <email>".
   - Tab stays inside the dialog, and Escape closes it.
   - The messages are announced without focus moving.

**Screenshot**: the list at 320 px.

### Clean up

Reactivate any test account you suspended.
