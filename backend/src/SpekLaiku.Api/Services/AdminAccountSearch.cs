namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks the User accounts search text (feature 014 spec FR-002, research section 5): spaces around it are removed,
/// and an empty text lists every account. 256 is the length of Identity's email column, so a longer text could never
/// match and is refused.
/// </summary>
public static class AdminAccountSearch
{
    public const int MaxLength = 256;

    public const string TooLongMessage = "Search text can be at most 256 characters.";

    /// <summary>The trimmed text, which may be empty, or the error message when it is too long.</summary>
    public static (string Text, string? Error) Validate(string? search)
    {
        var text = search?.Trim() ?? string.Empty;
        return text.Length > MaxLength ? (string.Empty, TooLongMessage) : (text, null);
    }
}
