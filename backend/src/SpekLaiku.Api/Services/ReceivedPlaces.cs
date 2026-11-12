namespace SpekLaiku.Api.Services;

/// <summary>
/// A category's listed places and the moment they were received from the map data service (spec FR-012).
/// </summary>
public sealed record ReceivedPlaces(IReadOnlyList<NearbyPlace> Places, DateTimeOffset ReceivedAt);
