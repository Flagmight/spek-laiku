namespace SpekLaiku.Api.Services;

/// <summary>
/// Checks every scheduled activity of a saved plan against the latest planning hours (feature 012 spec FR-005 to
/// FR-007, data-model.md). Activities that have started are only marked as past. The others get the latest weather
/// at their start hour and their problems. The saved plan is read, never changed (spec FR-014).
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
                ? Checked(entry, ActivityOf(entry, snapshot.Activities), day)
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

    private static PlanCheckEntry Checked(ScheduledActivity entry, CheckedPlanActivity? activity, PlanningDay day)
    {
        // An entry whose activity cannot be found is checked as Indoor without limits (data-model.md "Validation").
        if (activity is null)
        {
            return Entry(entry, ScheduledWeather.At(true, entry.StartTime, day), []);
        }

        var weather = ScheduledWeather.At(ActivityForecasts.IsWeatherIndependent(activity), entry.StartTime, day);
        return Entry(entry, weather, PlanWeatherRules.For(entry, activity, day));
    }

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
