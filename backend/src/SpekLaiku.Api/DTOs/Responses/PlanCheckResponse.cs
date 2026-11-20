namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// A saved plan checked against the latest forecast (feature 012 contracts/plan-check-api.md). <see cref="Status"/>
/// is <c>"checked"</c> or <c>"allPast"</c>; <see cref="Entries"/> follow the order of the saved plan's schedule.
/// </summary>
public sealed record PlanCheckResponse(
    DateTimeOffset SavedAt,
    string Status,
    string? ForecastUpdatedAt,
    IReadOnlyList<PlanCheckEntryResponse> Entries);
