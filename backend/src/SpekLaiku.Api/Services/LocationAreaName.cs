namespace SpekLaiku.Api.Services;

/// <summary>
/// The larger area shown after a place name (research section 3): the municipality when it says something
/// new, otherwise the county, otherwise "Lithuania". This gives "Kaunas, Kaunas County" rather than
/// "Kaunas, Kaunas", and tells apart villages that share a name.
/// </summary>
public static class LocationAreaName
{
    public static string For(string name, string? admin1, string? admin2)
    {
        if (!string.IsNullOrWhiteSpace(admin2)
            && !string.Equals(admin2.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            return admin2.Trim();
        }

        return string.IsNullOrWhiteSpace(admin1) ? "Lithuania" : $"{admin1.Trim()} County";
    }
}
