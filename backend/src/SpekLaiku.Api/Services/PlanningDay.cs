namespace SpekLaiku.Api.Services;

/// <summary>
/// One plan date: its sunrise and sunset in Lithuanian time (to the minute, for display) and its planning
/// hours in time order. <see cref="Hours"/> is empty when the date is today and no hour is left.
/// </summary>
public sealed record PlanningDay(DateOnly Date, TimeOnly Sunrise, TimeOnly Sunset, IReadOnlyList<PlanningHour> Hours);
