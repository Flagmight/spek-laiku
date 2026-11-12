namespace SpekLaiku.Api.Services;

/// <summary>
/// The <c>Places</c> settings (research section 6). They can be changed without a code change, for example
/// with the environment variable <c>Places__MaxRadiusKm</c>.
/// </summary>
public sealed class PlacesOptions
{
    public const string SectionName = "Places";

    public const string InvalidMessage =
        "Places:MaxRadiusKm must be 1 to 200, MaxPlacesPerActivity 1 to 20 and MaxAgeHours at least 1.";

    /// <summary>The largest maximum travel distance a plan can have (feature 004).</summary>
    public const int LargestRadiusKm = 200;

    public const int LargestPlacesPerActivity = 20;

    /// <summary>The cap on the search radius, whatever the plan's maximum travel distance (spec FR-006).</summary>
    public int MaxRadiusKm { get; init; } = 50;

    /// <summary>How many places each activity lists at most (spec FR-007).</summary>
    public int MaxPlacesPerActivity { get; init; } = 5;

    /// <summary>How long received places may be shown as current (spec FR-012).</summary>
    public int MaxAgeHours { get; init; } = 24;

    public static bool IsValid(PlacesOptions options) =>
        options.MaxRadiusKm is >= 1 and <= LargestRadiusKm
        && options.MaxPlacesPerActivity is >= 1 and <= LargestPlacesPerActivity
        && options.MaxAgeHours >= 1;
}
