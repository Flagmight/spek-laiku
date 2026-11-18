namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>One saved plan in a list, and the answer to a save (feature 010 contracts/plans-api.md).</summary>
public sealed record SavedPlanSummaryResponse(
    Guid Id,
    string Name,
    string LocationName,
    IReadOnlyList<DateOnly> Dates,
    DateTimeOffset SavedAt);
