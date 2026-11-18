namespace SpekLaiku.Api.Services;

/// <summary>A place in Lithuania as the application shows it: the service's id, name, area and position.</summary>
/// <remarks>
/// Stored as JSON in saved plans (feature 010 research section 4); do not rename members without a data
/// migration.
/// </remarks>
public sealed record PlaceLocation(long Id, string Name, string Area, double Latitude, double Longitude);
