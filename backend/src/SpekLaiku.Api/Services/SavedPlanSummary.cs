namespace SpekLaiku.Api.Services;

/// <summary>
/// A saved plan as the lists read it: never its stored schedule (feature 010 research section 5).
/// </summary>
public sealed record SavedPlanSummary(
    Guid Id,
    string Name,
    string LocationName,
    IReadOnlyList<DateOnly> Dates,
    DateTime SavedAtUtc);
