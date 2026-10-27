# User Login and Logout Quickstart

## Prerequisites

The same as `specs/001-user-registration/quickstart.md`: .NET SDK, PostgreSQL for the application database, Docker (or `SPEKLAIKU_TEST_POSTGRES`) for the integration tests, and installed frontend and backend dependencies. This feature adds no packages and no migration.

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

1. Correct email and password returns `200` with the user and sets the sign-in cookie; email letter case and spaces around it do not matter.
2. Unknown email, wrong password and a locked account all return the same `401` body.
3. Empty and invalid fields return `400` with the messages in `contracts/auth-api.md`, and count no failed attempt.
4. The 5th wrong password in a row locks the account; during the lock the correct password returns `401`; after `LockoutEnd` has passed it returns `200`; a successful login resets the count.
5. The lock writes exactly one log entry, containing the account id and no email or password; successful and failed logins write none.
6. A Suspended user with the correct password gets `200` with `"accountStatus": "Suspended"`, and lockout never changes the status.
7. A signed-in user gets `403` from login. Logout returns `204` with and without a session, and `/api/auth/me` returns `401` afterwards.
8. The cookie options are a 30-minute sliding expiration (FR-019).

The frontend tests must cover the Log in page states (idle, loading text, field errors, error summary, incorrect credentials, server error with Retry, timeout), the destination after login for each role and status and for `returnTo`, `safeReturnTo` rejecting outside addresses, the session-expired and "Log in to continue." messages, the navigation for visitors, signed-in and suspended users, logout success and failure, and the Account Suspended page guard.

## Manual Validation

Start the API and the frontend as in `README.md`, then open the address Vite prints (usually `http://localhost:5173`).

1. Register `user@example.com` on the Register page, select **Log out**: the home page shows "✓ Success: You have logged out." and the navigation shows Home, Log in and Register.
2. Open **Log in**, submit an empty form: both field messages and the error summary appear.
3. Enter `USER@example.com ` and the correct password: the home page opens, signed in, with no banner.
4. Log out, then enter a wrong password 5 times: every attempt shows "Error: Incorrect email or password."; the 6th attempt with the correct password shows the same message. Wait 15 minutes (or clear `LockoutEnd` in the database) and log in successfully.
5. In the database, set the account's `Role` to `Administrator` and log in: the home page opens (feature 015 later changes this).
6. Set `AccountStatus` to `Suspended` and log in: the Account Suspended page opens and the navigation shows Home and Log out only. Open `/account-suspended` as a visitor: the home page opens.
7. While signed in, open `/login`: the home page opens.
8. Open `/login?returnTo=https://example.com` and log in as an Active user: the home page opens, not the other site.
9. Use only the keyboard for steps 2 and 3, and repeat step 2 at 320 px width: no horizontal scrolling, full-width fields and buttons.

Restore the test account's `Role` and `AccountStatus` afterwards.
