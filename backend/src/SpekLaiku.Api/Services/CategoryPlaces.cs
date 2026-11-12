namespace SpekLaiku.Api.Services;

/// <summary>
/// The places listed for every activity of one category. An empty list means "No place found" (spec FR-019).
/// </summary>
public sealed record CategoryPlaces(Guid CategoryId, IReadOnlyList<NearbyPlace> Places);
