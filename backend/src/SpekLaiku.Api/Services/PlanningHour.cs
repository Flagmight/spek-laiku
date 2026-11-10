namespace SpekLaiku.Api.Services;

/// <summary>
/// One planning hour of a plan date in Lithuanian time, with its weather rounded to one decimal place
/// (research section 5) and whether it lies fully between sunrise and sunset. A <c>null</c> value is
/// "No data": the weather service has none for that hour.
/// </summary>
public sealed record PlanningHour(
    TimeOnly Start,
    TimeOnly End,
    decimal? TemperatureC,
    decimal? RainMmPerHour,
    decimal? WindMs,
    bool Daylight);
