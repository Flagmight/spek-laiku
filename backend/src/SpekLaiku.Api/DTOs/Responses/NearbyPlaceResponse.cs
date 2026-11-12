namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One place as the page shows it: never the category's map place tags or the map element's id (spec FR-013).
/// </summary>
public sealed record NearbyPlaceResponse(
    string Name,
    double Latitude,
    double Longitude,
    decimal DistanceKm,
    string? Area);
