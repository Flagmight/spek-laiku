using System.Text;

namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// The body of <c>POST /api/account/delete</c> (feature 016 contracts/account-deletion-api.md). The password is used
/// exactly as entered: never trimmed. No length rule. It is nullable so that an empty or missing value reaches
/// <see cref="Services.AccountDeletionValidator"/> instead of the generic model-validation error.
/// </summary>
public sealed record AccountDeletionRequest(string? Password)
{
    // A record's ToString prints every property, and ASP.NET Core logs action arguments that way at Trace level,
    // so the password is masked here, as in LoginRequest (spec FR-015, NFR-006).
    private bool PrintMembers(StringBuilder builder)
    {
        builder.Append("Password = ***");
        return true;
    }
}
