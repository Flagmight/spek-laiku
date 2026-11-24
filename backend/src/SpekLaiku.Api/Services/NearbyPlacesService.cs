using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The places of each category around a location (spec FR-005, FR-012; research sections 4 and 5). Each
/// category's places are reused for up to <see cref="PlacesOptions.MaxAgeHours"/>, keyed by the location,
/// the radius and the category's tags, so an administrator's tag change applies at once. The categories
/// without usable places are searched together in one call to the map data service. The age is checked
/// against <see cref="ForecastPeriod.GetNow"/>, the clock tests control. Failures are not cached: they reach
/// <c>ApiExceptionHandler</c>, so no category's places are shown, and the next request asks again. The search
/// goes through <see cref="MapPlacesSearchService"/>, which tries the main map data server and then the fallback;
/// places from either server are cached the same way (feature 017 spec FR-011).
/// </summary>
public sealed class NearbyPlacesService(
    MapPlacesSearchService mapPlacesSearch,
    IMemoryCache cache,
    ForecastPeriod forecastPeriod,
    IOptions<PlacesOptions> options)
{
    /// <summary>
    /// One entry per category, in the given order. The map data search must end before <paramref name="deadline"/>
    /// (feature 017 spec FR-007).
    /// </summary>
    public async Task<IReadOnlyList<ReceivedPlaces>> GetAsync(
        PlaceLocation location,
        int radiusKm,
        IReadOnlyList<CategoryTags> categories,
        RequestDeadline deadline,
        CancellationToken cancellationToken)
    {
        var now = forecastPeriod.GetNow();
        var maxAge = TimeSpan.FromHours(options.Value.MaxAgeHours);
        var results = new ReceivedPlaces[categories.Count];
        var missing = new List<int>();

        for (var index = 0; index < categories.Count; index++)
        {
            var tags = categories[index].Tags;
            if (tags.Count == 0)
            {
                // Nothing can match, so the service is not asked and nothing is stored.
                results[index] = new ReceivedPlaces([], now);
            }
            else if (cache.TryGetValue(Key(location, radiusKm, tags), out ReceivedPlaces? cached)
                && cached is not null
                && now - cached.ReceivedAt < maxAge)
            {
                results[index] = cached;
            }
            else
            {
                missing.Add(index);
            }
        }

        if (missing.Count > 0)
        {
            var tags = missing.SelectMany(index => categories[index].Tags).Distinct(StringComparer.Ordinal).ToList();
            var elements = await mapPlacesSearch.FindAsync(
                location.Latitude,
                location.Longitude,
                radiusKm,
                tags,
                deadline,
                cancellationToken);

            foreach (var index in missing)
            {
                var places = NearbyPlaceRules.For(
                    elements, categories[index].Tags, location, radiusKm, options.Value.MaxPlacesPerActivity);
                var received = new ReceivedPlaces(places, now);
                cache.Set(Key(location, radiusKm, categories[index].Tags), received, maxAge);
                results[index] = received;
            }
        }

        return results;
    }

    // The tags are sorted, so the same tags in another order share one entry.
    private static string Key(PlaceLocation location, int radiusKm, IReadOnlyList<string> tags) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"places:{location.Id}:{radiusKm}:{string.Join(",", tags.Order(StringComparer.Ordinal))}");
}
