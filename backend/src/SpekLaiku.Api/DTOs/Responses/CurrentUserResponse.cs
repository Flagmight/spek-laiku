namespace SpekLaiku.Api.DTOs.Responses;

public sealed record CurrentUserResponse(string Email, string Role, string AccountStatus);
