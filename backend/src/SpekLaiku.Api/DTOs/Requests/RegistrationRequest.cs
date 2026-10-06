namespace SpekLaiku.Api.DTOs.Requests;

public sealed record RegistrationRequest(
    string Email,
    string Password,
    string PasswordConfirmation);
