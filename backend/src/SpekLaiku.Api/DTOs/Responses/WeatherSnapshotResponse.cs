namespace SpekLaiku.Api.DTOs.Responses;

public sealed record WeatherSnapshotResponse(
    decimal? TemperatureC,
    decimal? RainMmPerHour,
    decimal? WindMs,
    bool IsIndoor);
