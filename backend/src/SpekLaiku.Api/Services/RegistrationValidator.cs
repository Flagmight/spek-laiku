using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the registration fields (FR-003, FR-005, FR-006, FR-010) and returns one message per failing field,
/// keyed by request field name in contract order. The duplicate-email check is not part of this.
/// </summary>
public static class RegistrationValidator
{
    public const int MaxEmailLength = 254;
    public const int MinPasswordLength = 8;

    public static IReadOnlyDictionary<string, string> Validate(RegistrationRequest request)
    {
        var errors = new Dictionary<string, string>();

        var email = request.Email?.Trim() ?? string.Empty;
        if (email.Length == 0)
        {
            errors["email"] = "Enter your email address.";
        }
        else if (email.Length > MaxEmailLength || !IsValidEmailFormat(email))
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

    /// <summary>
    /// No spaces, exactly one "@", at least one character before it, and a domain after it
    /// that contains a dot that is neither its first nor its last character.
    /// </summary>
    private static bool IsValidEmailFormat(string email)
    {
        if (email.Any(char.IsWhiteSpace))
        {
            return false;
        }

        var at = email.IndexOf('@');
        if (at < 1 || at != email.LastIndexOf('@'))
        {
            return false;
        }

        var domain = email[(at + 1)..];
        return domain.Length >= 3 && domain[1..^1].Contains('.');
    }
}
