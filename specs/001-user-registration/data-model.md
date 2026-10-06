# User Registration Data Model

## User Account

| Field                   | Type      | Required | Rules                                                                      |
| ----------------------- | --------- | -------: | -------------------------------------------------------------------------- |
| Id                      | string    |      Yes | ASP.NET Core Identity user identifier                                      |
| Email                   | string    |      Yes | Normalized, unique, maximum 254 characters                                 |
| UserName                | string    |      Yes | Normalized email or equivalent Identity username                           |
| PasswordHash            | string    |      Yes | Managed by ASP.NET Core Identity; never exposed                            |
| Role                    | enum      |      Yes | Registered User or Administrator; registration cannot create Administrator |
| AccountStatus           | enum      |      Yes | Pending Verification, Active, or Suspended                                 |
| EmailConfirmed          | boolean   |      Yes | False until confirmation succeeds                                          |
| RegistrationDate        | date-time |      Yes | UTC timestamp                                                              |
| VerificationSentAt      | date-time |       No | Set when the confirmation message is queued                                |
| VerificationAttemptedAt | date-time |       No | Set when a verification token is consumed                                  |

## State Transitions

```text
Pending Verification --successful confirmation--> Active
Pending Verification --suspension--> Suspended
Active --suspension--> Suspended
Suspended --reactivation--> Active
```

The registration flow creates `PendingVerification`. Verification may transition directly to `Active`. Suspended accounts remain verified and must not be reclassified as pending.

## Identity Token Relationship

ASP.NET Core Identity owns the email-confirmation token lifecycle. The application will persist the user and status but must not store raw confirmation tokens in the application data model.

## Validation Rules

- Email must be valid, trimmed, and at most 254 characters.
- Email uniqueness must be case-insensitive.
- Password length must be 8 to 128 characters.
- Registration must be atomic: no user is retained if email delivery fails.
- Account activation must occur only after token validation succeeds.
