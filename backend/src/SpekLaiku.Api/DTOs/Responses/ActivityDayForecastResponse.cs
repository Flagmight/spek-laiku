namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One activity on one date: its suitable periods, the longest of them for the step 3 overview (<c>null</c>
/// without any; feature 007 contracts/plan-forecast-api-changes.md), and a verdict for every planning hour.
/// </summary>
public sealed record ActivityDayForecastResponse(
    DateOnly Date,
    IReadOnlyList<SuitablePeriodResponse> Periods,
    SuitablePeriodResponse? LongestPeriod,
    IReadOnlyList<HourSuitabilityResponse> Hours);
