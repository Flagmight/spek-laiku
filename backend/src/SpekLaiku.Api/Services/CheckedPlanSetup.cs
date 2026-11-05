namespace SpekLaiku.Api.Services;

/// <summary>
/// A plan setup that passed every check: the location from the service (never from the request),
/// 1 to 7 distinct dates in ascending order, and the maximum travel distance (30 when none was sent).
/// </summary>
public sealed record CheckedPlanSetup(PlaceLocation Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm);
