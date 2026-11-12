namespace SpekLaiku.Api.Clients;

/// <summary>
/// One point, line or area from the map data: its position (a line's or area's centre) and all its tags.
/// <see cref="Key"/> is <c>"node/123"</c>, <c>"way/456"</c> or <c>"relation/789"</c>; it only orders equal
/// places and is never sent to the browser.
/// </summary>
public sealed record MapElement(
    string Key,
    double Latitude,
    double Longitude,
    IReadOnlyDictionary<string, string> Tags);
