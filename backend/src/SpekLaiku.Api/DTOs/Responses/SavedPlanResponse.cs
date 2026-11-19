namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// One saved plan, exactly as it was saved (feature 010 contracts/plans-api.md, spec FR-010). The scheduled,
/// unscheduled and travel parts have the shapes of the schedule response (features 008 and 009). The activities
/// are the owner's own values, which "Edit plan" loads into the planning steps (feature 011 research section 4).
/// The owner, the generated schedule id and the places' internal keys are not sent.
/// </summary>
public sealed record SavedPlanResponse(
    Guid Id,
    string Name,
    DateTimeOffset SavedAt,
    SavedPlanLocationResponse Location,
    IReadOnlyList<DateOnly> Dates,
    int MaxTravelDistanceKm,
    IReadOnlyList<CheckedPlanActivityResponse> Activities,
    IReadOnlyList<ScheduledActivityResponse> Scheduled,
    IReadOnlyList<UnscheduledActivityResponse> Unscheduled,
    TravelSummaryResponse Travel);
