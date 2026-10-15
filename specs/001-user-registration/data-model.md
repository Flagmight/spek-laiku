# User Registration Data Model

## User Account

| Field            | Type      | Required | Rules                                                                      |
| ---------------- | --------- | -------: | -------------------------------------------------------------------------- |
| Id               | string    |      Yes | ASP.NET Core Identity user identifier                                      |
| Email            | string    |      Yes | Normalized, unique, maximum 254 characters                                 |
| UserName         | string    |      Yes | Normalized email or equivalent Identity username                           |
| PasswordHash     | string    |      Yes | Managed by ASP.NET Core Identity; never exposed                            |
| Role             | string    |      Yes | Registered User or Administrator; registration cannot create Administrator |
| AccountStatus    | enum      |      Yes | Active or Suspended; registration creates Active                           |
| RegistrationDate | date-time |      Yes | UTC timestamp                                                              |

## State Transitions

```text
Active --suspension--> Suspended
Suspended --reactivation--> Active
```

The registration flow creates `Active`. Suspension and reactivation are performed by the Administrator Account Access Management feature (014), not by this feature.

## Validation Rules

- Email must be valid, trimmed, and at most 254 characters.
- Email uniqueness must be case-insensitive.
- Password must be at least 8 characters. There is no maximum length.
- Registration must be atomic: no partial user is retained if account creation fails.
