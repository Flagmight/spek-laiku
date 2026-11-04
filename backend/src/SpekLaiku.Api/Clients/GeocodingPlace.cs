namespace SpekLaiku.Api.Clients;

/// <summary>One place as the geocoding service describes it. <c>Admin1</c> is the county, <c>Admin2</c> the municipality.</summary>
public sealed record GeocodingPlace(
    long Id,
    string Name,
    double Latitude,
    double Longitude,
    string CountryCode,
    string? Admin1,
    string? Admin2);
