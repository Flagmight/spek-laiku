using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Stands in for the map data service in service tests: returns <see cref="Answer"/> or throws
/// <see cref="Failure"/>, and records every call so tests can see what was asked and how often.
/// </summary>
public sealed class RecordingMapPlacesClient : IMapPlacesClient
{
    private readonly Dictionary<MapDataServerRole, ExternalServiceException> roleFailures = [];

    public IReadOnlyList<MapElement> Answer { get; set; } = [];

    /// <summary>When set, every call throws it, as the real client does for a service failure.</summary>
    public ExternalServiceException? Failure { get; set; }

    /// <summary>
    /// Runs at the start of each call, before it is answered, with the server the caller chose. Tests use it to
    /// move the clock as if the attempt took time, or throw from it.
    /// </summary>
    public Action<MapDataServer>? OnCall { get; set; }

    public List<Call> Calls { get; } = [];

    /// <summary>Makes every call fail like the real client does for <paramref name="kind"/>.</summary>
    public void Fail(FailureKind kind) => Failure = new ExternalServiceException(ExternalService.MapData, kind);

    /// <summary>Makes only the calls to the server with <paramref name="role"/> fail like <paramref name="kind"/>.</summary>
    public void Fail(MapDataServerRole role, FailureKind kind) =>
        roleFailures[role] = new ExternalServiceException(ExternalService.MapData, kind);

    public Task<IReadOnlyList<MapElement>> FindAsync(
        MapDataServer server,
        TimeSpan timeout,
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken)
    {
        Calls.Add(new Call(server, timeout, latitude, longitude, radiusKm, tags.ToList()));
        OnCall?.Invoke(server);
        if (Failure is not null)
        {
            throw Failure;
        }

        if (roleFailures.TryGetValue(server.Role, out var roleFailure))
        {
            throw roleFailure;
        }

        return Task.FromResult(Answer);
    }

    /// <summary>One recorded call: the server and attempt time chosen by the caller, and what was asked.</summary>
    public sealed record Call(
        MapDataServer Server,
        TimeSpan Timeout,
        double Latitude,
        double Longitude,
        int RadiusKm,
        IReadOnlyList<string> Tags);
}
