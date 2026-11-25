namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// The status an administrator sets on an account: "Active" or "Suspended" (feature 014 contracts/admin-accounts-api.md).
/// Nullable, so a missing value reaches the controller's check and gets its message instead of the generic
/// model-validation error, as <see cref="RegistrationRequest"/> does.
/// </summary>
public sealed record AccountStatusRequest(string? AccountStatus);
