using SpekLaiku.Api.DTOs.Requests;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the account deletion request (feature 016 spec FR-002) and returns one message per failing field, keyed by
/// request field name (<c>password</c>). The wording is the same as <see cref="LoginValidator"/>.
/// </summary>
public static class AccountDeletionValidator
{
    public static IReadOnlyDictionary<string, string> Validate(AccountDeletionRequest request)
    {
        var errors = new Dictionary<string, string>();

        // No length rule: the password is only checked against the account. A password of only spaces is not empty,
        // because passwords are used exactly as entered (research section 4).
        if (string.IsNullOrEmpty(request.Password))
        {
            errors["password"] = "Enter your password.";
        }

        return errors;
    }
}
