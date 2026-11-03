namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// The create fields plus the <c>version</c> the form was opened with (spec FR-026).
/// </summary>
public sealed record UpdateActivityCategoryRequest(
    string? Name,
    string? Type,
    decimal? DefaultDurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC,
    string? PlaceTags,
    uint Version)
{
    /// <summary>The fields without the version, so create and update share one validator.</summary>
    public ActivityCategoryRequest ToCategoryRequest() => new(
        Name,
        Type,
        DefaultDurationHours,
        RequiresDaylight,
        MaxWindMs,
        MaxRainMmPerHour,
        MinTemperatureC,
        MaxTemperatureC,
        PlaceTags);
}
