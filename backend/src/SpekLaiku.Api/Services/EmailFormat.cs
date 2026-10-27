namespace SpekLaiku.Api.Services;

/// <summary>
/// The email format rule shared by registration and login (FR-003 of feature 001, FR-002 of feature 002).
/// </summary>
public static class EmailFormat
{
    public const int MaxLength = 254;

    /// <summary>
    /// No spaces, exactly one "@", at least one character before it, and a domain after it
    /// that contains a dot that is neither its first nor its last character.
    /// </summary>
    public static bool IsValid(string email)
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
