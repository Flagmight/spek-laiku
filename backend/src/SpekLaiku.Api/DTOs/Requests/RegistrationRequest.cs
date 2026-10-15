namespace SpekLaiku.Api.DTOs.Requests;

// The fields are nullable so that empty or missing values reach RegistrationValidator and get the FR-010
// messages instead of the generic model-validation error.
public sealed record RegistrationRequest(
    string? Email,
    string? Password,
    string? PasswordConfirmation);
