namespace SpekLaiku.Api.Services;

/// <summary>
/// The places for a plan (contracts/plan-places-api.md): the oldest receive time in Lithuanian time to the
/// minute, the search radius, and one entry per distinct category in order of first appearance.
/// </summary>
public sealed record PlanPlaces(TimeOnly UpdatedAt, int RadiusKm, IReadOnlyList<CategoryPlaces> Categories);
