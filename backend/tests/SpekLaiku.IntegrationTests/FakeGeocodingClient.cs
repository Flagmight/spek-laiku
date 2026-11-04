using System.Collections.Concurrent;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Stands in for the Open-Meteo geocoding service, so no test calls the live service (constitution III).
/// Answers are scripted per search text and per place id; anything not scripted finds nothing.
/// The API caches answers for an hour and the cache is shared by the test collection, so every test
/// uses its own search texts and place ids (research section 5).
/// </summary>
public sealed class FakeGeocodingClient : IGeocodingClient
{
    private readonly ConcurrentDictionary<string, IReadOnlyList<GeocodingPlace>> searches =
        new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, FailureKind> searchFailures = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<long, GeocodingPlace> places = new();
    private readonly ConcurrentDictionary<long, FailureKind> getFailures = new();
    private int searchCalls;
    private int getCalls;

    public int SearchCalls => searchCalls;

    public int GetCalls => getCalls;

    /// <summary>A search for <paramref name="text"/> returns these places.</summary>
    public void Script(string text, params GeocodingPlace[] results) => searches[text] = results;

    /// <summary>A search for <paramref name="text"/> fails like the real client does.</summary>
    public void ScriptFailure(string text, FailureKind kind) => searchFailures[text] = kind;

    /// <summary>A lookup of the place's id returns it.</summary>
    public void ScriptPlace(GeocodingPlace place) => places[place.Id] = place;

    /// <summary>A lookup of <paramref name="id"/> fails like the real client does.</summary>
    public void ScriptGetFailure(long id, FailureKind kind) => getFailures[id] = kind;

    public Task<IReadOnlyList<GeocodingPlace>> SearchAsync(string text, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref searchCalls);
        if (searchFailures.TryGetValue(text, out var kind))
        {
            throw new ExternalServiceException(ExternalService.LocationSearch, kind);
        }

        return Task.FromResult(searches.TryGetValue(text, out var results) ? results : []);
    }

    public Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref getCalls);
        if (getFailures.TryGetValue(id, out var kind))
        {
            throw new ExternalServiceException(ExternalService.LocationSearch, kind);
        }

        return Task.FromResult(places.GetValueOrDefault(id));
    }
}
