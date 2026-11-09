using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity the server accepted: the category's current name and type from the database (never from
/// the request) and the plan's own values. The four limits are <c>null</c> for Indoor.
/// </summary>
public sealed record CheckedPlanActivity(
    Guid CategoryId,
    string Name,
    ActivityType Type,
    decimal DurationHours,
    bool RequiresDaylight,
    decimal? MaxWindMs,
    decimal? MaxRainMmPerHour,
    decimal? MinTemperatureC,
    decimal? MaxTemperatureC);
