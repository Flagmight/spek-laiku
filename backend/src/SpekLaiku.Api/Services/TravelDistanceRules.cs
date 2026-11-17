namespace SpekLaiku.Api.Services;

/// <summary>
/// The travel check that runs after the scheduler has fixed every time slot (feature 009 spec FR-001 to FR-005,
/// research sections 4 and 5). Each date is walked in start-time order. The first activity uses its nearest
/// place and has no trip. Every later one uses the first of its listed places (nearest to the plan location
/// first) that is within the plan's maximum from the previous activity's place, or its nearest place when none
/// is; its trip is the straight-line distance from the previous place, rounded to 0.1 km and flagged when it is
/// greater than the maximum. The choice is greedy: earlier choices are never revisited. Dates, times and weather
/// are never changed (spec FR-009).
/// </summary>
public static class TravelDistanceRules
{
    public static (IReadOnlyList<ScheduledActivity> Scheduled, TravelSummary Summary) Apply(
        IReadOnlyList<ScheduledActivity> scheduled,
        IReadOnlyList<CategoryPlaces> categoryPlaces,
        int maxDistanceKm)
    {
        // The scheduler only schedules activities whose category has at least one listed place.
        var placesByCategory = categoryPlaces.ToDictionary(entry => entry.CategoryId, entry => entry.Places);
        var result = new List<ScheduledActivity>(scheduled.Count);

        foreach (var day in scheduled.GroupBy(activity => activity.Date).OrderBy(group => group.Key))
        {
            ScheduledActivity? previous = null;
            foreach (var activity in day.OrderBy(activity => activity.StartTime))
            {
                var candidates = placesByCategory[activity.CategoryId];
                var current = previous is null
                    ? activity with { Place = candidates[0], Travel = null }
                    : WithTrip(activity, candidates, previous.Place, maxDistanceKm);
                result.Add(current);
                previous = current;
            }
        }

        var tripsOverLimit = result.Count(activity => activity.Travel?.OverLimit == true);
        return (result, new TravelSummary(maxDistanceKm, tripsOverLimit));
    }

    /// <summary>
    /// The first listed place within the maximum from <paramref name="from"/>, else the nearest (spec FR-004,
    /// FR-005), with the trip to it. Each candidate's distance is worked out once.
    /// </summary>
    private static ScheduledActivity WithTrip(
        ScheduledActivity activity, IReadOnlyList<NearbyPlace> candidates, NearbyPlace from, int maxDistanceKm)
    {
        var trips = candidates.Select(candidate => (Place: candidate, DistanceKm: DistanceKm(from, candidate))).ToList();
        var (place, distanceKm) = trips.FirstOrDefault(trip => trip.DistanceKm <= maxDistanceKm, trips[0]);

        return activity with
        {
            Place = place,
            Travel = new TravelLeg(from.Name, distanceKm, distanceKm > maxDistanceKm)
        };
    }

    /// <summary>The trip as the user sees it: the rounded value is also the compared value (research section 3).</summary>
    private static decimal DistanceKm(NearbyPlace from, NearbyPlace to) =>
        GeoDistance.RoundToTenth(GeoDistance.Kilometres(from.Latitude, from.Longitude, to.Latitude, to.Longitude));
}
