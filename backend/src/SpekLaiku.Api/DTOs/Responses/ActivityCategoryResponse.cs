namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>The category object in contracts/categories-api.md. The limits are <c>null</c> for Indoor.</summary>
public sealed record ActivityCategoryResponse(
    Guid Id,
    string Name,
    string Type,
    decimal DefaultDurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC,
    IReadOnlyList<string> PlaceTags,
    uint Version);
