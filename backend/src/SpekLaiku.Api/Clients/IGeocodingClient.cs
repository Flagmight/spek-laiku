namespace SpekLaiku.Api.Clients;

/// <summary>
/// Searches and looks up places. The interface exists so tests can replace the external service with
/// fake responses (constitution III, research section 4).
/// </summary>
public interface IGeocodingClient
{
    /// <summary>Up to 10 places in Lithuania matching the text; empty when nothing matches.</summary>
    Task<IReadOnlyList<GeocodingPlace>> SearchAsync(string text, CancellationToken cancellationToken);

    /// <summary>The place with this id, or <c>null</c> when the service does not know it.</summary>
    Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken);
}
