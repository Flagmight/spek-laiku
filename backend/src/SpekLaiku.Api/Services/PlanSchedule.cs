namespace SpekLaiku.Api.Services;

/// <summary>
/// The complete scheduling result for a checked plan: activities that were assigned a slot and those that
/// were not. Both lists may be empty; together they cover every activity exactly once (feature 008 spec
/// SC-002, SC-003). <see cref="Travel"/> is the plan-level travel check (feature 009 spec FR-006).
/// </summary>
public sealed record PlanSchedule(
    IReadOnlyList<ScheduledActivity> Scheduled,
    IReadOnlyList<UnscheduledActivity> Unscheduled,
    TravelSummary Travel);
