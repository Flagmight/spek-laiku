namespace SpekLaiku.Api.Services;

/// <summary>
/// What a generated schedule and a saved plan store as JSON: the checked setup, the checked activities and the
/// full schedule (feature 010 spec FR-003, research section 4). The records it contains are a storage format:
/// renaming one of their members makes stored plans unreadable unless a data migration is added.
/// </summary>
public sealed record PlanSnapshot(
    CheckedPlanSetup Setup,
    IReadOnlyList<CheckedPlanActivity> Activities,
    PlanSchedule Schedule);
