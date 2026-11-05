using System.Text.Json.Serialization;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// The search answer. <c>results</c> is missing, not empty, when nothing matches (research section 1).
/// </summary>
internal sealed record OpenMeteoSearchResponse(
    [property: JsonPropertyName("results")] List<OpenMeteoPlace>? Results);

/// <summary>One place in a search answer, or the whole answer of <c>/v1/get</c>. Other fields are ignored.</summary>
internal sealed record OpenMeteoPlace(
    [property: JsonPropertyName("id")] long? Id,
    [property: JsonPropertyName("name")] string? Name,
    [property: JsonPropertyName("latitude")] double? Latitude,
    [property: JsonPropertyName("longitude")] double? Longitude,
    [property: JsonPropertyName("country_code")] string? CountryCode,
    [property: JsonPropertyName("admin1")] string? Admin1,
    [property: JsonPropertyName("admin2")] string? Admin2)
{
    /// <summary>The place, or <c>null</c> when a field the application needs is missing.</summary>
    public GeocodingPlace? ToPlace() =>
        Id is { } id
        && !string.IsNullOrWhiteSpace(Name)
        && Latitude is { } latitude
        && Longitude is { } longitude
        && !string.IsNullOrWhiteSpace(CountryCode)
            ? new GeocodingPlace(id, Name, latitude, longitude, CountryCode, Admin1, Admin2)
            : null;
}
