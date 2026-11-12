namespace SpekLaiku.Api.Services;

/// <summary>
/// One activity on one plan date: its suitable periods, the longest of them (<c>null</c> without any), and the
/// verdict for every planning hour, in the same order as the date's <see cref="PlanningDay.Hours"/>.
/// </summary>
public sealed record ActivityDayForecast(
    DateOnly Date,
    IReadOnlyList<SuitablePeriod> Periods,
    SuitablePeriod? LongestPeriod,
    IReadOnlyList<HourSuitability> Hours);
