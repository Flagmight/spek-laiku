namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One account as an administrator sees it (feature 014 contracts/admin-accounts-api.md). Exactly these five values:
/// never a password, a password hash, a stamp or a lockout field (spec FR-011).
/// </summary>
public sealed record AdminAccountResponse(
    string Id,
    string Email,
    string Role,
    string AccountStatus,
    DateTime RegistrationDate);
