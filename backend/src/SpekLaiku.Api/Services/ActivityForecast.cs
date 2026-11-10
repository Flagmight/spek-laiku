namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity's forecast over all plan dates (spec FR-021, FR-022). The page words the counts and flags;
/// every rule behind them is decided here on the server (research section 7).
/// </summary>
/// <param name="WeatherIndependent">Indoor and not requiring daylight: the page shows only the indoor message.</param>
/// <param name="SuitableHours">Suitable hours over all dates.</param>
/// <param name="DatesWithSuitableHours">Dates with at least one suitable hour.</param>
/// <param name="HasLongEnoughPeriod">At least one period on any date is as long as the activity's duration.</param>
/// <param name="Days">One entry per plan date, in date order.</param>
public sealed record ActivityForecast(
    bool WeatherIndependent,
    int SuitableHours,
    int DatesWithSuitableHours,
    bool HasLongEnoughPeriod,
    IReadOnlyList<ActivityDayForecast> Days);
