namespace SpekLaiku.Api.Services;

/// <summary>
/// The straight-line (great-circle) distance between two positions, worked out with the haversine formula
/// (research section 3). It is simple and correct at Lithuania's latitude.
/// </summary>
public static class GeoDistance
{
    /// <summary>The mean Earth radius.</summary>
    public const double EarthRadiusKm = 6371.0088;

    public static double Kilometres(double latitude1, double longitude1, double latitude2, double longitude2)
    {
        var deltaLatitude = ToRadians(latitude2 - latitude1);
        var deltaLongitude = ToRadians(longitude2 - longitude1);
        var a = Math.Pow(Math.Sin(deltaLatitude / 2), 2)
            + Math.Cos(ToRadians(latitude1)) * Math.Cos(ToRadians(latitude2)) * Math.Pow(Math.Sin(deltaLongitude / 2), 2);

        return 2 * EarthRadiusKm * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180;
}
