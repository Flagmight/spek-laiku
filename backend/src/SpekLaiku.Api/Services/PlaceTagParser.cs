using System.Text.RegularExpressions;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Parses the map place tags as the administrator typed them (spec FR-009, research section 3):
/// comma-separated <c>key=value</c> pairs, stored without spaces, without empty entries and
/// without duplicates, in the order first entered.
/// </summary>
public static partial class PlaceTagParser
{
    public const int MaxLength = 200;

    public const string FormatMessage = "Enter tags in the form key=value, for example leisure=slipway.";
    public const string LengthMessage = "Map place tags can be at most 200 characters.";

    public static PlaceTagParseResult Parse(string? text)
    {
        if (text is null)
        {
            return PlaceTagParseResult.Invalid(FormatMessage);
        }

        // The limit applies to the text as sent, before trimming.
        if (text.Length > MaxLength)
        {
            return PlaceTagParseResult.Invalid(LengthMessage);
        }

        var tags = new List<string>();
        foreach (var entry in text.Split(','))
        {
            var trimmed = entry.Trim();
            if (trimmed.Length == 0)
            {
                continue;
            }

            var parts = trimmed.Split('=');
            if (parts.Length != 2)
            {
                return PlaceTagParseResult.Invalid(FormatMessage);
            }

            var key = parts[0].Trim();
            var value = parts[1].Trim();
            if (!TagPart().IsMatch(key) || !TagPart().IsMatch(value))
            {
                return PlaceTagParseResult.Invalid(FormatMessage);
            }

            var tag = $"{key}={value}";
            if (!tags.Contains(tag))
            {
                tags.Add(tag);
            }
        }

        return tags.Count == 0 ? PlaceTagParseResult.Invalid(FormatMessage) : PlaceTagParseResult.Valid(tags);
    }

    // Letters, digits, "_", ":" and "-". The parts are trimmed first, so "$" cannot match before a newline.
    [GeneratedRegex(@"^[\p{L}\p{N}_:-]+$")]
    private static partial Regex TagPart();
}

/// <summary>Either the normalized tags or the field message.</summary>
public sealed record PlaceTagParseResult(IReadOnlyList<string>? Tags, string? Error)
{
    public static PlaceTagParseResult Valid(IReadOnlyList<string> tags) => new(tags, null);

    public static PlaceTagParseResult Invalid(string error) => new(null, error);
}
