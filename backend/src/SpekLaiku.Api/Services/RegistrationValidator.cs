using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the registration fields (FR-003, FR-005, FR-006, FR-010) and returns one message per failing field,
/// keyed by request field name in contract order. The duplicate-email check is not part of this.
/// </summary>
public static class RegistrationValidator
{
    public const int MinPasswordLength = 8;

    public static IReadOnlyDictionary<string, string> Validate(RegistrationRequest request)
    {
        var errors = new Dictionary<string, string>();

        var email = request.Email?.Trim() ?? string.Empty;
        if (email.Length == 0)
        {
            errors["email"] = "Enter your email address.";
        }
        else if (email.Length > EmailFormat.MaxLength || !EmailFormat.IsValid(email))
        {
            errors["email"] = "Enter a valid email address.";
        }

        // The password is used exactly as entered: spaces are kept and count toward the minimum length.
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = "Enter a password.";
        }
        else if (request.Password.Length < MinPasswordLength)
        {
            errors["password"] = "Password must be at least 8 characters.";
        }

        if (string.IsNullOrEmpty(request.PasswordConfirmation))
        {
            errors["passwordConfirmation"] = "Confirm your password.";
        }
        else if (!string.Equals(request.Password, request.PasswordConfirmation, StringComparison.Ordinal))
        {
            errors["passwordConfirmation"] = "Passwords do not match.";
        }

        return errors;
    }
}
