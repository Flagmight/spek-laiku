using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Stands in for the map data service in service tests: returns <see cref="Answer"/> or throws
/// <see cref="Failure"/>, and records every call so tests can see what was asked and how often.
/// </summary>
public sealed class RecordingMapPlacesClient : IMapPlacesClient
{
    public IReadOnlyList<MapElement> Answer { get; set; } = [];

    /// <summary>When set, every call throws it, as the real client does for a service failure.</summary>
    public ExternalServiceException? Failure { get; set; }

    public List<(double Latitude, double Longitude, int RadiusKm, IReadOnlyList<string> Tags)> Calls { get; } = [];

    /// <summary>Makes every call fail like the real client does for <paramref name="kind"/>.</summary>
    public void Fail(FailureKind kind) => Failure = new ExternalServiceException(ExternalService.MapData, kind);

    public Task<IReadOnlyList<MapElement>> FindAsync(
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken)
    {
        Calls.Add((latitude, longitude, radiusKm, tags.ToList()));
        if (Failure is not null)
        {
            throw Failure;
        }

        return Task.FromResult(Answer);
    }
}
