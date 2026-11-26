# Data Model: Account Deletion (016)

**No new table, column, index or migration.** The feature deletes existing rows.

## User Account (`AspNetUsers`, entity `ApplicationUser`, features 001 and 002)

| Field | Use in this feature |
|---|---|
| `Id` | Identifies the signed-in user's account. Written to the log. |
| `Email`, `NormalizedEmail` | The email is shown on the Account page (from `GET /api/auth/me`) and in the dialog question. Never logged. Deleting the row frees the unique `NormalizedEmail` index for a new registration (spec FR-006). |
| `PasswordHash` | Checked by Identity against the entered password. Never read for display or returned. |
| `AccessFailedCount`, `LockoutEnd` | The shared login lock (feature 002 FR-026): a wrong password adds 1; the fifth in a row sets `LockoutEnd` to now + 15 minutes. A correct password before the lock resets the count. |
| `Role`, `AccountStatus` | Must be `Registered User` and `Active` for the deletion, both in the authorization policy and in the delete statement (research sections 3 and 5). |

**Lifecycle**: Active Registered User → deleted (the row is gone). There is no "Deleted" status, no grace period and no way back (spec FR-003). Administrator accounts and Suspended accounts cannot reach the deletion.

## Saved Plan (`SavedPlans`, entity `SavedPlan`, feature 010)

| Field | Use in this feature |
|---|---|
| `OwnerId` | All rows with the deleted account's id are deleted in the same transaction, and their number is logged. The existing foreign key with `ON DELETE CASCADE` also removes any plan added at the same moment. |

## Rows removed by the existing cascade (Identity)

`AspNetUserClaims`, `AspNetUserLogins`, `AspNetUserRoles` and `AspNetUserTokens` rows of the account are removed by the foreign keys created in `InitialIdentitySchema`. The application does not use them today.

## Not affected

- `GeneratedSchedules` belong to no account and expire after 30 minutes (feature 010).
- `ActivityCategories` are not linked to accounts.

## Validation rules

| Rule | Where | Answer |
|---|---|---|
| Password missing or empty (`""`); spaces only is not empty | `AccountDeletionValidator` | 400, `errors.password`: "Enter your password." No attempt counted. |
| Password does not match | Identity, through `AccountDeletionService` | 400, `errors.password`: "Password is incorrect." One attempt counted. |
| Account locked, or this attempt locks it | Identity, through `AccountDeletionService` | 429, "Too many incorrect passwords. Try again in 15 minutes." |
| Caller is not a signed-in Active Registered User | `ActiveRegisteredUser` policy | 401 (visitor) or 403 (others). |
| Account changed between the policy and the delete | Conditional delete in `AccountDeletionService` | 403, nothing deleted. |

## Service result (`Services/AccountDeletionResult.cs`)

One of: `Deleted` (with the plan count, for the log only, not returned), `Invalid` (field errors keyed `password`), `IncorrectPassword`, `LockedOut`, `NotAllowed` (the account changed, research section 5).

## Browser state (`stores/useAccountDeletionStore.ts`)

| Field | Meaning |
|---|---|
| `dialogOpen` | The dialog is shown. |
| `password` | The field's value; emptied on close, wrong password, lock, success and reset (research section 14). |
| `status` | `idle`, `pending` or `serverError` (Retry offered). |
| `fieldError` | "Enter your password." or "Password is incorrect.", shown next to the field with "Error:". |
| `error` | The lock message or the technical error, shown in the dialog with "Error:". |
| `focusRequest` | Asks the dialog to focus the field after a wrong password or a lock. |
| `controller` | Aborts the request on timeout or reset. |
