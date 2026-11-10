namespace SpekLaiku.Api.Services;

/// <summary>
/// The <c>Forecast</c> settings (research section 9). They can be changed without a code change, for
/// example with the environment variable <c>Forecast__MaxAgeMinutes</c>.
/// </summary>
public sealed class ForecastOptions
{
    public const string SectionName = "Forecast";

    public const string InvalidMessage = "Forecast:MaxAgeMinutes must be positive and 0 <= FirstHour < LastHour <= 23.";

    /// <summary>How long a received forecast may be shown as current (spec FR-009).</summary>
    public int MaxAgeMinutes { get; init; } = 30;

    /// <summary>The start of the first planning hour of each date (spec FR-010).</summary>
    public int FirstHour { get; init; } = 6;

    /// <summary>The end of the last planning hour; at most 23 so every hour ends on the same day.</summary>
    public int LastHour { get; init; } = 22;

    public static bool IsValid(ForecastOptions options) =>
        options.MaxAgeMinutes > 0
        && options.FirstHour >= 0
        && options.FirstHour < options.LastHour
        && options.LastHour <= 23;
}
