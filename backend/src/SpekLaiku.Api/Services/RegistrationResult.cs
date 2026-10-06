namespace SpekLaiku.Api.Services;

public sealed record RegistrationResult(bool Succeeded, string? ErrorMessage = null);
