namespace SpekLaiku.Api.Services;

/// <summary>
/// The forecast for a checked plan: when it was received (Lithuanian time, to the minute), the planning hours
/// of each plan date, and each activity's verdicts in request order.
/// </summary>
public sealed record PlanForecast(
    TimeOnly UpdatedAt,
    IReadOnlyList<PlanningDay> Days,
    IReadOnlyList<ActivityForecast> Activities);
