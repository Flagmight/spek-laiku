namespace SpekLaiku.Api.Clients;

/// <summary>
/// Finds places in the map data around a position. The interface exists so tests can replace the external
/// service with fake responses (constitution III).
/// </summary>
public interface IMapPlacesClient
{
    /// <summary>
    /// The named points, lines and areas within <paramref name="radiusKm"/> of the position that have at least
    /// one of the <c>key=value</c> <paramref name="tags"/>. Each element appears once, in no defined order.
    /// Throws <see cref="ExternalServiceException"/> for <see cref="ExternalService.MapData"/> on every failure.
    /// </summary>
    Task<IReadOnlyList<MapElement>> FindAsync(
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken);
}
