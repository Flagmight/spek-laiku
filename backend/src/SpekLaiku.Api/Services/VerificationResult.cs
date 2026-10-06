namespace SpekLaiku.Api.Services;

public sealed record VerificationResult(bool Succeeded, string? ErrorMessage = null);
