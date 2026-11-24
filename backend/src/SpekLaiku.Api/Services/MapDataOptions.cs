using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The <c>MapData</c> settings: the main map data server, an optional fallback and their waiting times (feature 017
/// spec FR-001, FR-002, FR-006; research section 2). They can be changed without a code change, for example with
/// the environment variable <c>MapData__MainServer</c>. <see cref="MapDataOptionsValidator"/> checks them when the
/// API starts.
/// </summary>
public sealed class MapDataOptions
{
    public const string SectionName = "MapData";

    public const int ShortestTimeoutSeconds = 1;

    public const int LongestTimeoutSeconds = 8;

    /// <summary>The main server's root address. The public OpenStreetMap server unless configured.</summary>
    public string MainServer { get; init; } = "https://overpass-api.de/";

    /// <summary>How long the main server may take to answer.</summary>
    public int MainTimeoutSeconds { get; init; } = 4;

    /// <summary>The fallback server's root address; empty means no fallback.</summary>
    public string? FallbackServer { get; init; }

    /// <summary>How long the fallback server may take to answer.</summary>
    public int FallbackTimeoutSeconds { get; init; } = 4;

    /// <summary>The main server, then the fallback when one is configured. Call only after validation.</summary>
    public IReadOnlyList<MapDataServer> Servers()
    {
        var main = new MapDataServer(
            ToAddress(MainServer), MapDataServerRole.Main, TimeSpan.FromSeconds(MainTimeoutSeconds));
        if (string.IsNullOrWhiteSpace(FallbackServer))
        {
            return [main];
        }

        var fallback = new MapDataServer(
            ToAddress(FallbackServer), MapDataServerRole.Fallback, TimeSpan.FromSeconds(FallbackTimeoutSeconds));
        return [main, fallback];
    }

    /// <summary>
    /// The address with a trailing <c>/</c>, so <c>new Uri(address, "api/interpreter")</c> keeps any path
    /// (research section 2). Throws <see cref="UriFormatException"/> for text that is not an absolute address.
    /// </summary>
    public static Uri ToAddress(string text)
    {
        var trimmed = text.Trim();
        return new Uri(trimmed.EndsWith('/') ? trimmed : trimmed + "/", UriKind.Absolute);
    }
}
