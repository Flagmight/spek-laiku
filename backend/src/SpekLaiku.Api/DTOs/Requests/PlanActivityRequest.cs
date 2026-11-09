namespace SpekLaiku.Api.DTOs.Requests;

/// <summary>
/// One activity of the plan as entered. The numbers are <c>decimal?</c> so that a missing value gets the
/// field message instead of a request error. <c>Type</c> is the type the activity was added with, so the
/// server can tell a changed category from an empty limit (research section 4).
/// </summary>
public sealed record PlanActivityRequest(
    Guid? CategoryId,
    string? Type,
    decimal? DurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC);
