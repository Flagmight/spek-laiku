namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One plan date with its sunrise, sunset and planning hours; no hours when today has none left.</summary>
public sealed record ForecastDayResponse(
    DateOnly Date,
    string Sunrise,
    string Sunset,
    IReadOnlyList<ForecastHourResponse> Hours);
