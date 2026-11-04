using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Stands in for the geocoding service in service tests: answers are scripted per search text and per
/// place id, failures can be scripted, and every call is recorded so tests can see what was asked.
/// </summary>
public sealed class RecordingGeocodingClient : IGeocodingClient
{
    private readonly Dictionary<string, IReadOnlyList<GeocodingPlace>> searches = [];
    private readonly Dictionary<long, GeocodingPlace> places = [];

    public List<string> SearchTexts { get; } = [];

    public List<long> GetIds { get; } = [];

    /// <summary>When set, every call throws it, as the real client does for a service failure.</summary>
    public ExternalServiceException? Failure { get; set; }

    public void Script(string text, params GeocodingPlace[] results) => searches[text] = results;

    public void ScriptPlace(GeocodingPlace place) => places[place.Id] = place;

    public Task<IReadOnlyList<GeocodingPlace>> SearchAsync(string text, CancellationToken cancellationToken)
    {
        SearchTexts.Add(text);
        if (Failure is not null)
        {
            throw Failure;
        }

        return Task.FromResult(searches.TryGetValue(text, out var results) ? results : []);
    }

    public Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken)
    {
        GetIds.Add(id);
        if (Failure is not null)
        {
            throw Failure;
        }

        return Task.FromResult(places.GetValueOrDefault(id));
    }
}
