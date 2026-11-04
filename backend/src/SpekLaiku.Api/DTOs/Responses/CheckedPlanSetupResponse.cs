namespace SpekLaiku.Api.DTOs.Responses;

/// <summary>
/// A plan setup that passed the check: the location as the service describes it, the dates in ascending
/// order (written as yyyy-MM-dd) and the maximum travel distance.
/// </summary>
public sealed record CheckedPlanSetupResponse(
    LocationResponse Location,
    IReadOnlyList<DateOnly> Dates,
    int MaxTravelDistanceKm);
