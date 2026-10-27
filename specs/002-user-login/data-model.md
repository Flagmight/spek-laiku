# Data Model: Login and Logout

This feature adds **no tables, columns or migrations**. It reads the `ApplicationUser` from feature 001 and uses Identity lockout columns that the `InitialIdentitySchema` migration already created.

## User Account (`ApplicationUser`, existing)

| Field | Source | Used by this feature |
| --- | --- | --- |
| `Id` | Identity | Identifies the account in the lockout log entry (FR-027). |
| `Email`, `NormalizedEmail` | Identity | Login lookup; case-insensitive through the normalized value (FR-002). |
| `PasswordHash` | Identity | Checked by Identity's password hasher; never returned or logged (FR-003, FR-022). |
| `Role` | Feature 001 (`"Registered User"` or `"Administrator"`) | Returned at login; the frontend uses it for the destination (FR-010, FR-011). |
| `AccountStatus` | Feature 001 (`Active` or `Suspended`) | Returned at login; a Suspended user is sent to the Account Suspended page (FR-010, FR-021). Never changed here. |
| `AccessFailedCount` | Identity | Failed attempts in a row; reset by a successful login or when a lock starts (FR-026). |
| `LockoutEnd` | Identity | End of the 15-minute lock, or empty when not locked (FR-026). |
| `LockoutEnabled` | Identity | `true` for every account (`Lockout.AllowedForNewUsers = true`, the existing default). |

### Lockout states

```text
Not locked (count 0-4)
  ── wrong password, count < 4 ──▶ Not locked (count + 1)
  ── wrong password, count = 4 ──▶ Locked until now + 15 min (count reset to 0, one log entry)
  ── correct password ──────────▶ Signed in (count reset to 0)
Locked
  ── any attempt before LockoutEnd ──▶ Locked (same 401, nothing counted, nothing logged)
  ── LockoutEnd has passed ──────────▶ Not locked (count 0)
```

## Session (sign-in cookie, existing)

Not stored in the database. The Identity application cookie holds the user's claims.

| Property | Value |
| --- | --- |
| Starts | Successful login or registration |
| Ends | Logout, or 15 to 30 minutes after the last authenticated request (30-minute sliding expiration, FR-019) |
| Cookie | HttpOnly, Secure, SameSite=Lax, non-persistent |

## Request and response DTOs

| DTO | Fields | Notes |
| --- | --- | --- |
| `LoginRequest` (new) | `Email?`, `Password?` | Nullable so empty values reach `LoginValidator`. `PrintMembers` masks the password. |
| `CurrentUserResponse` (existing) | `Email`, `Role`, `AccountStatus` | Returned by login and `/api/auth/me`. Mapped by the existing `CurrentUserMappingProfile`. |

## Validation rules

| Field | Rule | Message |
| --- | --- | --- |
| Email | Required after trimming | "Enter your email address." |
| Email | `EmailFormat.IsValid` and at most 254 characters (shared with registration) | "Enter a valid email address." |
| Password | Required, not trimmed | "Enter your password." |
| Email + password | Account exists, not locked, password matches | "Incorrect email or password." (`401`) |
