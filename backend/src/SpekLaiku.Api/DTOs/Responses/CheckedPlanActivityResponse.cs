namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One activity the server accepted, with the stored name and type and the plan's own values.</summary>
public sealed record CheckedPlanActivityResponse(
    Guid CategoryId,
    string Name,
    string Type,
    decimal DurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC);
