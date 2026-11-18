namespace SpekLaiku.Api.Services;

/// <summary>
/// Weather at the start hour of an assigned slot. All values are <c>null</c> when <see cref="IsIndoor"/> is
/// true (spec FR-009: "Weather does not affect this indoor activity.").
/// </summary>
/// <remarks>
/// Stored as JSON in saved plans (feature 010 research section 4); do not rename members without a data
/// migration.
/// </remarks>
public sealed record WeatherSnapshot(
    decimal? TemperatureC,
    decimal? RainMmPerHour,
    decimal? WindMs,
    bool IsIndoor);
