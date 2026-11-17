namespace SpekLaiku.Api.Services;

/// <summary>
/// The trip from the previous scheduled activity on the same date to this one (feature 009 spec FR-001).
/// <see cref="DistanceKm"/> is the straight-line distance between the two chosen places,
/// <see cref="GeoDistance.RoundToTenth"/>; <see cref="OverLimit"/> is <c>DistanceKm &gt; MaxDistanceKm</c> of the
/// plan (strictly greater; spec FR-002).
/// </summary>
public sealed record TravelLeg(string FromPlaceName, decimal DistanceKm, bool OverLimit);
