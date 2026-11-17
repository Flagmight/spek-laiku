namespace SpekLaiku.Api.DTOs.Responses;

public sealed record PlanScheduleResponse(
    IReadOnlyList<ScheduledActivityResponse> Scheduled,
    IReadOnlyList<UnscheduledActivityResponse> Unscheduled,
    TravelSummaryResponse Travel);
