namespace SpekLaiku.Api.Services;

/// <summary>
/// The plan-level result of the travel check (feature 009 spec FR-006). <see cref="MaxDistanceKm"/> is the
/// checked setup's <c>MaxTravelDistanceKm</c>, 1 to 200, 30 when none was sent (spec FR-003);
/// <see cref="TripsOverLimit"/> counts the trips whose <see cref="TravelLeg.OverLimit"/> is <c>true</c>.
/// </summary>
public sealed record TravelSummary(int MaxDistanceKm, int TripsOverLimit);
