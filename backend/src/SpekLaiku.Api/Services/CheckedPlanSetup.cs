namespace SpekLaiku.Api.Services;

/// <summary>
/// A plan setup that passed every check: the location from the service (never from the request),
/// 1 to 7 distinct dates in ascending order, and the maximum travel distance (30 when none was sent).
/// </summary>
/// <remarks>
/// Stored as JSON in saved plans (feature 010 research section 4); do not rename members without a data
/// migration.
/// </remarks>
public sealed record CheckedPlanSetup(PlaceLocation Location, IReadOnlyList<DateOnly> Dates, int MaxTravelDistanceKm);
