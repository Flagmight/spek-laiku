using System.Globalization;
using System.Text;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Builds the one Overpass QL query of a place request (research section 4): one statement per distinct
/// <c>key=value</c> tag for named points, lines and areas within the radius, and each element's tags with
/// a centre point for lines and areas.
/// </summary>
internal static class OverpassQuery
{
    /// <summary>
    /// <paramref name="timeoutSeconds"/> is the service's own time limit: the attempt time in whole seconds
    /// (feature 017 research section 5), so the server also stops working on a query the client gave up on.
    /// </summary>
    public static string Build(
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        int timeoutSeconds)
    {
        var invariant = CultureInfo.InvariantCulture;
        var around = string.Create(
            invariant,
            $"(around:{radiusKm * 1000},{latitude.ToString("F5", invariant)},{longitude.ToString("F5", invariant)});");

        var query = new StringBuilder();
        query.Append(invariant, $"[out:json][timeout:{timeoutSeconds}];\n(\n");
        foreach (var tag in tags.Distinct(StringComparer.Ordinal))
        {
            var parts = tag.Split('=', 2);
            var value = parts.Length == 2 ? parts[1] : string.Empty;
            query.Append($"  nwr[\"{Escape(parts[0])}\"=\"{Escape(value)}\"][\"name\"]{around}\n");
        }

        query.Append(");\nout tags center qt;");
        return query.ToString();
    }

    // PlaceTagParser already allows no quotes or backslashes in tags; this is a second guard against
    // injection into the query (OWASP).
    private static string Escape(string text) => text.Replace("\\", "\\\\").Replace("\"", "\\\"");
}
