namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One activity's forecast: the counts and flags the page words, and one entry per plan date.</summary>
public sealed record ActivityForecastResponse(
    bool WeatherIndependent,
    int SuitableHours,
    int DatesWithSuitableHours,
    bool HasLongEnoughPeriod,
    IReadOnlyList<ActivityDayForecastResponse> Days);
