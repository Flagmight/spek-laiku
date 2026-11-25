using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The five values of an account that the User accounts page may see (feature 014 data-model.md). The list query
/// projects each row to this record, so the password hash and the stamps are never read, and the status stays an
/// enum until AutoMapper turns it into its name in memory (research section 10).
/// </summary>
public sealed record AdminAccountSummary(
    string Id,
    string Email,
    string Role,
    AccountStatus AccountStatus,
    DateTime RegistrationDate);
