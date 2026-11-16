namespace SpekLaiku.Api.Services;

/// <summary>
/// Weather at the start hour of an assigned slot. All values are <c>null</c> when <see cref="IsIndoor"/> is
/// true (spec FR-009: "Weather does not affect this indoor activity.").
/// </summary>
public sealed record WeatherSnapshot(
    decimal? TemperatureC,
    decimal? RainMmPerHour,
    decimal? WindMs,
    bool IsIndoor);
