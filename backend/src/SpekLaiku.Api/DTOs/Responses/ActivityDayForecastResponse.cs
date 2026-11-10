namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One activity on one date: its suitable periods and a verdict for every planning hour.</summary>
public sealed record ActivityDayForecastResponse(
    DateOnly Date,
    IReadOnlyList<SuitablePeriodResponse> Periods,
    IReadOnlyList<HourSuitabilityResponse> Hours);
