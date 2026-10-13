namespace SpekLaiku.Api.DTOs.Responses;

public sealed record RegistrationResponse(bool Success, string Message, string? AccountStatus);
