using System.Globalization;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Which map elements an activity lists, and in which order (spec FR-006, FR-007; research sections 3 and 4):
/// the named elements with one of the category's exact <c>key=value</c> tags within the radius, each once,
/// nearest first, then by name in Lithuanian order, then by key, at most <c>maxPlaces</c>.
/// </summary>
public static class NearbyPlaceRules
{
    private static readonly CompareInfo LithuanianOrder = CultureInfo.GetCultureInfo("lt-LT").CompareInfo;

    public static IReadOnlyList<NearbyPlace> For(
        IReadOnlyList<MapElement> elements,
        IReadOnlyList<string> categoryTags,
        PlaceLocation origin,
        int radiusKm,
        int maxPlaces)
    {
        var tags = categoryTags.ToHashSet(StringComparer.Ordinal);

        return elements
            .Where(element => element.Tags.Any(tag => tags.Contains($"{tag.Key}={tag.Value}")))
            .Select(element => ToPlace(element, origin))
            .OfType<NearbyPlace>()
            // The shown distance is the one compared and ordered, so a place shown as "30.0 km away" is never
            // left out of a 30 km search, and ties are the ones the user can see (research section 3).
            .Where(place => place.DistanceKm <= radiusKm)
            .DistinctBy(place => place.Key, StringComparer.Ordinal)
            .OrderBy(place => place.DistanceKm)
            .ThenBy(place => place.Name, Comparer<string>.Create(
                (left, right) => LithuanianOrder.Compare(left, right, CompareOptions.None)))
            .ThenBy(place => place.Key, StringComparer.Ordinal)
            .Take(maxPlaces)
            .ToList();
    }

    /// <summary>The place, or <c>null</c> when the element has no name to show.</summary>
    private static NearbyPlace? ToPlace(MapElement element, PlaceLocation origin)
    {
        var name = Text(element, "name:lt") ?? Text(element, "name");
        if (name is null)
        {
            return null;
        }

        var distance = GeoDistance.Kilometres(origin.Latitude, origin.Longitude, element.Latitude, element.Longitude);

        return new NearbyPlace(
            name,
            Math.Round(element.Latitude, 5, MidpointRounding.AwayFromZero),
            Math.Round(element.Longitude, 5, MidpointRounding.AwayFromZero),
            Math.Round((decimal)distance, 1, MidpointRounding.AwayFromZero),
            Text(element, "addr:city"),
            element.Key);
    }

    /// <summary>The tag's value trimmed, or <c>null</c> when it is missing or blank.</summary>
    private static string? Text(MapElement element, string key) =>
        element.Tags.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value) ? value.Trim() : null;
}
