namespace SpekLaiku.Api.Services;

/// <summary>
/// One place listed for an activity (spec FR-007, FR-018): its shown name, its position rounded to 5 decimal
/// places, its distance from the plan's location rounded to 0.1 km, and its town or area when known.
/// <see cref="Key"/> is the map element's key; it only orders equal places and is not sent to the browser.
/// </summary>
public sealed record NearbyPlace(
    string Name,
    double Latitude,
    double Longitude,
    decimal DistanceKm,
    string? Area,
    string Key);
