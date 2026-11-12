namespace SpekLaiku.Api.Services;

/// <summary>Joins consecutive suitable hours of one date into periods (spec FR-021, research section 7).</summary>
public static class SuitablePeriods
{
    /// <param name="hours">One date's hours in time order.</param>
    /// <param name="durationHours">The activity's duration, to mark periods it does not fit into.</param>
    public static IReadOnlyList<SuitablePeriod> From(IReadOnlyList<HourSuitability> hours, decimal durationHours)
    {
        var periods = new List<SuitablePeriod>();
        TimeOnly? start = null;
        TimeOnly end = default;

        foreach (var hour in hours)
        {
            // An hour joins the run only when it starts where the previous suitable hour ended.
            if (hour.Suitable && start is not null && hour.Start == end)
            {
                end = hour.Start.AddHours(1);
                continue;
            }

            if (start is not null)
            {
                periods.Add(Period(start.Value, end, durationHours));
                start = null;
            }

            if (hour.Suitable)
            {
                start = hour.Start;
                end = hour.Start.AddHours(1);
            }
        }

        if (start is not null)
        {
            periods.Add(Period(start.Value, end, durationHours));
        }

        return periods;
    }

    /// <summary>
    /// The longest period, the earliest of equally long ones, or <c>null</c> without any (feature 007 FR-016,
    /// research section 8). The step 3 overview shows it; the page does not pick it.
    /// </summary>
    /// <param name="periods">One date's periods in time order.</param>
    public static SuitablePeriod? Longest(IReadOnlyList<SuitablePeriod> periods)
    {
        SuitablePeriod? longest = null;
        foreach (var period in periods)
        {
            // Strictly longer, so the earlier of two equally long periods is kept.
            if (longest is null || period.LengthHours > longest.LengthHours)
            {
                longest = period;
            }
        }

        return longest;
    }

    private static SuitablePeriod Period(TimeOnly start, TimeOnly end, decimal durationHours)
    {
        var length = (end - start).Hours;
        return new SuitablePeriod(start, end, length, length < durationHours);
    }
}
