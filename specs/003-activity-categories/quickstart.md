# Activity Category Management Quickstart

## Prerequisites

The same as `specs/002-user-login/quickstart.md`: .NET SDK, the EF Core tool (`dotnet-ef`), PostgreSQL for the application database, Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests, and installed frontend and backend dependencies. This feature adds **no package** and **one migration**, `AddActivityCategories` (`data-model.md`).

## Database

Apply the new migration to your local database (from the repository root):

```powershell
dotnet ef database update --project .\backend\src\SpekLaiku.Api
```

Afterwards the `ActivityCategories` table exists and holds the five starter categories (Cycling, Heritage site, Kayaking, Museum, Picnic).

## Automated Validation

From the repository root:

```powershell
dotnet restore .\SpekLaiku.slnx
dotnet build .\SpekLaiku.slnx
dotnet format .\SpekLaiku.slnx --verify-no-changes
dotnet test .\SpekLaiku.slnx
```

From `frontend/`:

```powershell
npm ci
npm run lint
npm run format:check
npm test
npm run build
```

The backend tests must cover:

1. Every row of the authorization table in `contracts/categories-api.md`, for each of the four endpoints: visitor `401`; Active and Suspended Registered User and Suspended Administrator `403`; Active Administrator allowed. A refused create or update stores nothing.
2. After the migrations, the list contains the five starter categories with the values in `data-model.md`, in alphabetical order.
3. Create returns `201` with the category, and the list then contains it; an Indoor category is stored without weather limits even if they are sent.
4. Each validation message in the contract table, with all failing fields returned together and in key order; boundary values (0, 30, 20, -30, 45, 0.5, 12) accepted; `1.25` and duration `1.3` refused; tags with spaces and empty entries normalized; duplicate tags stored once; `historic=*`, `historic` and a 201-character tags text refused.
5. A name that differs only in letter case or spaces from another category's name is refused; renaming a category to its own name in another letter case is allowed; the database index refuses a duplicate `NormalizedName` (schema test).
6. Update returns `200` with a new `version`; a second update with the old `version` returns `409` and changes nothing; `GET /{id}` then returns the stored values; an unknown id returns `404`.
7. Changing a category from Outdoor to Indoor removes its weather limits.
8. Unit tests for `ActivityLimitRules`, `PlaceTagParser`, `ActivityCategoryValidator` and `ActivityCategoryService` (including the unique-violation translation and the conflict path), and for `ActiveAdministratorHandler` (each role and status, and a cookie whose account no longer exists).

The frontend tests must cover the Activity categories page states (loading text, list in alphabetical order, empty state, list load error with Retry, create and edit forms, Indoor hiding the weather fields, field errors and error summary, focus on the form heading and on the first invalid field, saving text, server error with Retry, timeout, conflict with Reload, success banner, Cancel), the `AdministratorOnly` guard for visitor, Registered User, Suspended user and Administrator, the Access Denied page, the "Categories" navigation item for each role and status, session expiry during a save, keyboard order, accessibility attributes and the 320 px layout rules.

## Manual Validation

Start the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`). Make an account an Administrator with the SQL in the README section "Testing an Administrator or Suspended account".

1. Log in as the Administrator: the navigation shows **Categories**. Open it: the five starter categories are listed in alphabetical order.
2. Select **Create category** and **Save** with an empty form: the four messages from spec User Story 3 scenario 1 appear with an error summary, and focus moves to the Name field.
3. Create the Outdoor category "Swimming" from spec User Story 1 scenario 3: "✓ Success: Category saved." stays until dismissed and Swimming appears in the list.
4. Create "swimming " again: "Error: A category with this name already exists."
5. Edit **Kayaking**, change the maximum wind to 6 and the tags to `leisure=slipway`, save, edit it again: the new values are shown.
6. Open Kayaking for editing in two browser windows signed in as the Administrator. Save a change in the first, then in the second: the second shows "Error: This category was changed by someone else. Reload it and try again."; **Reload** shows the first window's values.
7. Change **Museum** to Outdoor: the weather fields appear empty and must be filled. Cancel.
8. Log out and open `/admin/categories`: the Log in page shows "Log in to continue."; logging in as the Administrator returns to the Activity categories page.
9. Log in as a Registered User and open `/admin/categories`: the Access Denied page is shown and there is no **Categories** link. Set the Administrator's `AccountStatus` to `Suspended` and open `/admin/categories` as them: the Account Suspended page opens.
10. Repeat steps 2 and 5 with the keyboard only, and at 320 px width: the list comes first, the form below it, no horizontal scrolling, full-width fields and buttons.

Restore the test accounts' `Role` and `AccountStatus` afterwards. Categories created during manual testing stay in the database, because this feature has no delete.
