namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One planning hour. A value is <c>null</c> when the weather service has none ("No data").</summary>
public sealed record ForecastHourResponse(
    string Start,
    string End,
    decimal? TemperatureC,
    decimal? RainMmPerHour,
    decimal? WindMs,
    bool Daylight);
