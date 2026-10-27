using System.Text;

namespace SpekLaiku.Api.DTOs.Requests;

// The fields are nullable so that empty or missing values reach LoginValidator and get the FR-008
// messages instead of the generic model-validation error.
public sealed record LoginRequest(string? Email, string? Password)
{
    // A record's ToString prints every property, and ASP.NET Core logs action arguments that way
    // at Trace level, so the password is masked here (FR-022).
    private bool PrintMembers(StringBuilder builder)
    {
        builder.Append($"Email = {Email}, Password = ***");
        return true;
    }
}
