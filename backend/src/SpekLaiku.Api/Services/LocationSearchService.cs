using Microsoft.Extensions.Caching.Memory;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Searches and looks up places in Lithuania (spec FR-004 to FR-006). Answers are cached for an hour so
/// repeated searches and the later check rarely reach the external service (research section 5);
/// failures are not cached and reach <c>ApiExceptionHandler</c>.
/// </summary>
public sealed class LocationSearchService(IGeocodingClient geocodingClient, IMemoryCache cache)
{
    public const int MinQueryLength = 2;
    public const int MaxQueryLength = 100;
    public const int MaxResults = 10;
    public const string QueryMessage = "Enter between 2 and 100 characters.";

    private const string LithuaniaCode = "LT";
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

    public async Task<LocationSearchResult> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var text = query?.Trim() ?? string.Empty;
        if (text.Length is < MinQueryLength or > MaxQueryLength)
        {
            return LocationSearchResult.Invalid(new Dictionary<string, string> { ["query"] = QueryMessage });
        }

        // The service reads text after a comma as an exact area filter, so editing a chosen
        // "Kaunas, Kaunas County" would find nothing; only the place name is searched (research section 1).
        var searched = text.Split(',', 2)[0].Trim();
        if (searched.Length < MinQueryLength)
        {
            return LocationSearchResult.Success([]);
        }

        var cacheKey = "location-search:" + searched.ToLowerInvariant();
        if (cache.TryGetValue(cacheKey, out IReadOnlyList<PlaceLocation>? cached) && cached is not null)
        {
            return LocationSearchResult.Success(cached);
        }

        var places = await geocodingClient.SearchAsync(searched, cancellationToken);
        IReadOnlyList<PlaceLocation> locations = places.Where(IsInLithuania).Take(MaxResults).Select(ToLocation).ToList();
        cache.Set(cacheKey, locations, CacheDuration);
        foreach (var location in locations)
        {
            cache.Set(PlaceKey(location.Id), location, CacheDuration);
        }

        return LocationSearchResult.Success(locations);
    }

    /// <summary>The place in Lithuania with this id, or <c>null</c> when the service does not know it.</summary>
    public async Task<PlaceLocation?> FindAsync(long id, CancellationToken cancellationToken)
    {
        if (cache.TryGetValue(PlaceKey(id), out PlaceLocation? cached) && cached is not null)
        {
            return cached;
        }

        var place = await geocodingClient.GetAsync(id, cancellationToken);
        if (place is null || !IsInLithuania(place))
        {
            return null;
        }

        var location = ToLocation(place);
        cache.Set(PlaceKey(id), location, CacheDuration);
        return location;
    }

    private static string PlaceKey(long id) => "location:" + id;

    private static bool IsInLithuania(GeocodingPlace place) =>
        string.Equals(place.CountryCode, LithuaniaCode, StringComparison.OrdinalIgnoreCase);

    private static PlaceLocation ToLocation(GeocodingPlace place) =>
        new(place.Id, place.Name, LocationAreaName.For(place.Name, place.Admin1, place.Admin2), place.Latitude, place.Longitude);
}
