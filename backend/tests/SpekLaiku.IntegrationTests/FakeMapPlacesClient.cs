using System.Collections.Concurrent;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Stands in for the OpenStreetMap Overpass service, so no test calls the live service (constitution III).
/// Elements are scripted per position, and a call returns only the scripted elements that have at least one
/// of the requested tags, as the real service does. A position that is not scripted gets an invalid answer,
/// as from a broken service. The API reuses places per location id, radius and tags in a cache shared by the
/// test collection, so every test uses its own place id and position (research section 5).
/// </summary>
public sealed class FakeMapPlacesClient : IMapPlacesClient
{
    private readonly ConcurrentDictionary<(double, double), IReadOnlyList<MapElement>> answers = new();
    private readonly ConcurrentDictionary<(double, double), FailureKind> failures = new();
    private readonly ConcurrentDictionary<(double, double, MapDataServerRole), FailureKind> roleFailures = new();
    private readonly ConcurrentDictionary<MapDataServerRole, int> callsPerRole = new();
    private readonly ConcurrentDictionary<(double, double), IReadOnlyList<string>> lastTags = new();
    private int calls;
    private MapDataServer? lastServer;

    public int Calls => calls;

    /// <summary>How many calls went to the server with <paramref name="role"/>.</summary>
    public int CallsFor(MapDataServerRole role) => callsPerRole.TryGetValue(role, out var count) ? count : 0;

    /// <summary>The server of the last call, so tests can see which configured address was used.</summary>
    public MapDataServer? LastServer => lastServer;

    /// <summary>A search around this position finds these elements (filtered by the requested tags).</summary>
    public void Script(double latitude, double longitude, IReadOnlyList<MapElement> elements) =>
        answers[(latitude, longitude)] = elements;

    /// <summary>A search around this position fails like the real client does.</summary>
    public void ScriptFailure(double latitude, double longitude, FailureKind kind) =>
        failures[(latitude, longitude)] = kind;

    /// <summary>
    /// A search around this position fails like the real client does, but only on the server with
    /// <paramref name="role"/>.
    /// </summary>
    public void ScriptFailure(double latitude, double longitude, FailureKind kind, MapDataServerRole role) =>
        roleFailures[(latitude, longitude, role)] = kind;

    /// <summary>A search around this position no longer fails, on any server.</summary>
    public void ScriptRecovery(double latitude, double longitude)
    {
        failures.TryRemove((latitude, longitude), out _);
        foreach (var role in Enum.GetValues<MapDataServerRole>())
        {
            roleFailures.TryRemove((latitude, longitude, role), out _);
        }
    }

    /// <summary>The tags of the last search around this position, or <c>null</c> when there was none.</summary>
    public IReadOnlyList<string>? LastTags(double latitude, double longitude) =>
        lastTags.TryGetValue((latitude, longitude), out var tags) ? tags : null;

    public Task<IReadOnlyList<MapElement>> FindAsync(
        MapDataServer server,
        TimeSpan timeout,
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        callsPerRole.AddOrUpdate(server.Role, 1, (_, count) => count + 1);
        Volatile.Write(ref lastServer, server);
        lastTags[(latitude, longitude)] = tags.ToList();
        if (failures.TryGetValue((latitude, longitude), out var kind)
            || roleFailures.TryGetValue((latitude, longitude, server.Role), out kind))
        {
            throw new ExternalServiceException(ExternalService.MapData, kind);
        }

        if (!answers.TryGetValue((latitude, longitude), out var elements))
        {
            throw new ExternalServiceException(ExternalService.MapData, FailureKind.InvalidResponse);
        }

        var requested = tags.ToHashSet(StringComparer.Ordinal);
        IReadOnlyList<MapElement> found = elements
            .Where(element => element.Tags.Any(tag => requested.Contains($"{tag.Key}={tag.Value}")))
            .ToList();
        return Task.FromResult(found);
    }

    /// <summary>An element with its key (for example <c>"node/1"</c>), position and tags.</summary>
    public static MapElement Element(string key, double latitude, double longitude, params (string Key, string Value)[] tags) =>
        new(key, latitude, longitude, tags.ToDictionary(tag => tag.Key, tag => tag.Value));
}
