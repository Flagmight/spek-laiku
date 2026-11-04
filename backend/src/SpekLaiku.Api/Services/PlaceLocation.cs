namespace SpekLaiku.Api.Services;

/// <summary>A place in Lithuania as the application shows it: the service's id, name, area and position.</summary>
public sealed record PlaceLocation(long Id, string Name, string Area, double Latitude, double Longitude);
