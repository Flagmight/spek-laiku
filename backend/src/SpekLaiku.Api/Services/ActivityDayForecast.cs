namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity on one plan date: its suitable periods and the verdict for every planning hour, in the same
/// order as the date's <see cref="PlanningDay.Hours"/>.
/// </summary>
public sealed record ActivityDayForecast(
    DateOnly Date,
    IReadOnlyList<SuitablePeriod> Periods,
    IReadOnlyList<HourSuitability> Hours);
