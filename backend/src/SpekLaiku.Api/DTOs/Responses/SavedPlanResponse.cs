namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One saved plan, exactly as it was saved (feature 010 contracts/plans-api.md, spec FR-010). The scheduled,
/// unscheduled and travel parts have the shapes of the schedule response (features 008 and 009). The activities'
/// limits and the owner are not sent.
/// </summary>
public sealed record SavedPlanResponse(
    Guid Id,
    string Name,
    DateTimeOffset SavedAt,
    SavedPlanLocationResponse Location,
    IReadOnlyList<DateOnly> Dates,
    int MaxTravelDistanceKm,
    IReadOnlyList<ScheduledActivityResponse> Scheduled,
    IReadOnlyList<UnscheduledActivityResponse> Unscheduled,
    TravelSummaryResponse Travel);
