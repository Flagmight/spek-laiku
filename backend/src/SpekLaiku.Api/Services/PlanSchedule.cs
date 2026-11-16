namespace SpekLaiku.Api.Services;

/// <summary>
/// The complete scheduling result for a checked plan: activities that were assigned a slot and those that
/// were not. Both lists may be empty; together they cover every activity exactly once (spec SC-002, SC-003).
/// </summary>
public sealed record PlanSchedule(
    IReadOnlyList<ScheduledActivity> Scheduled,
    IReadOnlyList<UnscheduledActivity> Unscheduled);
