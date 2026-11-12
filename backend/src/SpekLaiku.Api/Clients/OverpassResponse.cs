using System.Text.Json.Serialization;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// The Overpass answer. <c>remark</c> is set when the service hit its own time or memory limit, in which
/// case <c>elements</c> may be incomplete (research section 7). Other fields are ignored.
/// </summary>
internal sealed record OverpassResponse(
    [property: JsonPropertyName("remark")] string? Remark,
    [property: JsonPropertyName("elements")] List<OverpassElement>? Elements);

/// <summary>
/// One element: a node has <c>lat</c> and <c>lon</c>; a way or relation has a <c>center</c> when the query
/// asks for <c>out center</c>.
/// </summary>
internal sealed record OverpassElement(
    [property: JsonPropertyName("type")] string? Type,
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("lat")] double? Lat,
    [property: JsonPropertyName("lon")] double? Lon,
    [property: JsonPropertyName("center")] OverpassCenter? Center,
    [property: JsonPropertyName("tags")] Dictionary<string, string>? Tags)
{
    /// <summary>The element, or <c>null</c> when it has no type or no position.</summary>
    public MapElement? ToMapElement()
    {
        var latitude = Lat ?? Center?.Lat;
        var longitude = Lon ?? Center?.Lon;
        if (string.IsNullOrEmpty(Type) || latitude is null || longitude is null)
        {
            return null;
        }

        return new MapElement(
            $"{Type}/{Id}",
            latitude.Value,
            longitude.Value,
            Tags ?? new Dictionary<string, string>());
    }
}

/// <summary>The centre point the service gives for a way or relation.</summary>
internal sealed record OverpassCenter(
    [property: JsonPropertyName("lat")] double? Lat,
    [property: JsonPropertyName("lon")] double? Lon);
