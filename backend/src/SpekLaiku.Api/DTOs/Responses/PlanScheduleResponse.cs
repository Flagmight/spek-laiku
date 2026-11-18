namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// The schedule as contracts/plan-schedule-api.md of features 008 to 010 defines it.
/// <see cref="GeneratedScheduleId"/> refers to the remembered copy used by Save, <c>null</c> when nothing was
/// scheduled.
/// </summary>
public sealed record PlanScheduleResponse(
    Guid? GeneratedScheduleId,
    IReadOnlyList<ScheduledActivityResponse> Scheduled,
    IReadOnlyList<UnscheduledActivityResponse> Unscheduled,
    TravelSummaryResponse Travel);
