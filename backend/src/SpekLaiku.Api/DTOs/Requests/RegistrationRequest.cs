using System.Text;

namespace SpekLaiku.Api.DTOs.Requests;

// The fields are nullable so that empty or missing values reach RegistrationValidator and get the FR-010
// messages instead of the generic model-validation error.
public sealed record RegistrationRequest(
    string? Email,
    string? Password,
    string? PasswordConfirmation)
{
    // A record's ToString prints every property, and ASP.NET Core logs action arguments that way
    // at Trace level, so the passwords are masked here (FR-009).
    private bool PrintMembers(StringBuilder builder)
    {
        builder.Append($"Email = {Email}, Password = ***, PasswordConfirmation = ***");
        return true;
    }
}
