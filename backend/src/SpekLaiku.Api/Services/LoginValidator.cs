using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the login fields (FR-002, FR-005, FR-008) and returns one message per failing field,
/// keyed by request field name in the order <c>email</c>, <c>password</c>.
/// </summary>
public static class LoginValidator
{
    public static IReadOnlyDictionary<string, string> Validate(LoginRequest request)
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

        // No length rule: an existing password is only checked against the account. A password of
        // only spaces is not empty, because passwords are used exactly as entered.
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = "Enter your password.";
        }

        return errors;
    }
}
