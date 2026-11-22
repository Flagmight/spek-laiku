namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks every scheduled activity of a saved plan against the latest planning hours (feature 012 spec FR-005 to
/// FR-007, data-model.md). Activities that have started are only marked as past. The others get the latest weather
/// at their start hour and their problems: weather, daylight, overlaps with the other saved entries and the saved
/// trip. The saved plan is read, never changed (spec FR-014).
/// </summary>
public static class PlanCheckRules
{
    /// <param name="snapshot">The saved plan.</param>
    /// <param name="days">The latest planning days of the dates still to check; a date without one has passed.</param>
    /// <param name="now">The current time in Lithuania.</param>
    /// <returns>One entry per scheduled activity, in the stored order.</returns>
    public static IReadOnlyList<PlanCheckEntry> Check(
        PlanSnapshot snapshot,
        IReadOnlyList<PlanningDay> days,
        DateTimeOffset now)
    {
        var daysByDate = days.ToDictionary(day => day.Date);

        return snapshot.Schedule.Scheduled
            .Select(entry => daysByDate.TryGetValue(entry.Date, out var day) && !HasStarted(entry, now)
                ? Checked(entry, snapshot, day)
                : Past(entry))
            .ToList();
    }

    /// <summary>
    /// The activity's start in Lithuanian time. It is built as <see cref="PlanningDays"/> builds its hours, so an
    /// activity counts as started exactly when its first hour is no longer planned (research section 8).
    /// </summary>
    internal static DateTimeOffset StartInstant(ScheduledActivity entry)
    {
        var local = entry.Date.ToDateTime(entry.StartTime);
        return new DateTimeOffset(local, ForecastPeriod.Lithuania.GetUtcOffset(local));
    }

    /// <summary>Started at or before now: not checked (spec FR-006, User Story 5).</summary>
    internal static bool HasStarted(ScheduledActivity entry, DateTimeOffset now) => StartInstant(entry) <= now;

    /// <summary>
    /// The entry's weather and daylight problems, then its overlaps and its saved trip, so the problems stay in
    /// <see cref="PlanRule"/> order (research section 7).
    /// </summary>
    private static PlanCheckEntry Checked(ScheduledActivity entry, PlanSnapshot snapshot, PlanningDay day)
    {
        var activity = ActivityOf(entry, snapshot.Activities);

        // An entry whose activity cannot be found is checked as Indoor without limits (data-model.md "Validation").
        var weather = ScheduledWeather.At(
            activity is null || ActivityForecasts.IsWeatherIndependent(activity), entry.StartTime, day);
        List<PlanProblem> problems = activity is null ? [] : PlanWeatherRules.For(entry, activity, day).ToList();

        problems.AddRange(Overlaps(entry, snapshot.Schedule.Scheduled));

        if (entry.Travel is { OverLimit: true } travel)
        {
            problems.Add(new PlanProblem(
                PlanRule.Travel,
                Value: travel.DistanceKm,
                Limit: snapshot.Schedule.Travel.MaxDistanceKm,
                FromPlaceName: travel.FromPlaceName));
        }

        return Entry(entry, weather, problems);
    }

    /// <summary>
    /// Every other entry on the same date, past ones included, whose time overlaps this entry's, ordered by its
    /// start. The test is the one <see cref="PlanScheduler"/> uses, so touching entries do not overlap.
    /// </summary>
    private static IEnumerable<PlanProblem> Overlaps(ScheduledActivity entry, IReadOnlyList<ScheduledActivity> scheduled) =>
        scheduled
            .Where(other => !ReferenceEquals(other, entry)
                && other.Date == entry.Date
                && entry.StartTime < other.EndTime
                && other.StartTime < entry.EndTime)
            .OrderBy(other => other.StartTime)
            .Select(other => new PlanProblem(
                PlanRule.Overlap,
                OtherActivityName: other.ActivityName,
                OtherStartTime: other.StartTime,
                OtherEndTime: other.EndTime));

    private static PlanCheckEntry Past(ScheduledActivity entry) => Entry(entry, null, [], past: true);

    private static PlanCheckEntry Entry(
        ScheduledActivity entry,
        WeatherSnapshot? weather,
        IReadOnlyList<PlanProblem> problems,
        bool past = false) =>
        new(entry.Date, entry.StartTime, entry.EndTime, entry.ActivityName, past, weather, problems);

    /// <summary>
    /// The entry's own activity by its stored index, when that index is valid and of the same category. Otherwise,
    /// for plans saved before feature 012, the first activity of the category (research section 4).
    /// </summary>
    private static CheckedPlanActivity? ActivityOf(ScheduledActivity entry, IReadOnlyList<CheckedPlanActivity> activities)
    {
        if (entry.ActivityIndex is { } index
            && index >= 0
            && index < activities.Count
            && activities[index].CategoryId == entry.CategoryId)
        {
            return activities[index];
        }

        return activities.FirstOrDefault(activity => activity.CategoryId == entry.CategoryId);
    }
}
