using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The weather and daylight problems of one scheduled activity against the latest forecast (feature 012 spec
/// FR-005, FR-007, research sections 5 and 6). The comparisons are <see cref="HourSuitabilityRules.Breaches"/>, the
/// ones the schedule was made with, so a plan whose forecast has not changed has no problem. Each broken limit is
/// given once, with its worst value over the activity's hours and the first hour that has it. An Outdoor activity
/// with a missing value or hour gets one NoForecast problem; an activity that requires daylight gets BeforeSunrise
/// and AfterSunset from the hours' daylight flags. Problems are returned in <see cref="PlanRule"/> order.
/// </summary>
public static class PlanWeatherRules
{
    /// <param name="entry">The scheduled activity, as saved.</param>
    /// <param name="activity">Its activity, with its own saved limits.</param>
    /// <param name="day">The latest planning hours of the entry's date.</param>
    public static IReadOnlyList<PlanProblem> For(ScheduledActivity entry, CheckedPlanActivity activity, PlanningDay day)
    {
        var hours = HoursOf(entry, day);
        var worst = new Dictionary<PlanRule, (LimitBreach Breach, TimeOnly Time)>();

        foreach (var hour in hours.OfType<PlanningHour>())
        {
            foreach (var breach in HourSuitabilityRules.Breaches(hour, activity))
            {
                // Strictly worse only, so the first hour with the worst value is kept.
                if (!worst.TryGetValue(breach.Rule, out var kept) || IsWorse(breach, kept.Breach))
                {
                    worst[breach.Rule] = (breach, hour.Start);
                }
            }
        }

        var problems = worst
            .Select(pair => new PlanProblem(
                pair.Key,
                Time: pair.Value.Time,
                Value: pair.Value.Breach.Value,
                Limit: pair.Value.Breach.Limit))
            .ToList();

        if (activity.Type == ActivityType.Outdoor && FirstHourWithoutForecast(entry, hours) is { } missing)
        {
            problems.Add(new PlanProblem(PlanRule.NoForecast, Time: missing));
        }

        if (activity.RequiresDaylight)
        {
            AddDaylightProblems(problems, entry, hours, day);
        }

        return problems.OrderBy(problem => problem.Rule).ToList();
    }

    /// <summary>
    /// One slot per hour of the entry's time, in time order: the planning hour that starts then, or <c>null</c> when
    /// the latest forecast has no such hour. Slots are whole hours, as <see cref="PlanningDays"/> builds them.
    /// </summary>
    private static IReadOnlyList<PlanningHour?> HoursOf(ScheduledActivity entry, PlanningDay day)
    {
        var byStart = day.Hours.ToDictionary(hour => hour.Start);
        var slots = new List<PlanningHour?>();

        for (var start = entry.StartTime; start < entry.EndTime; start = start.AddHours(1))
        {
            slots.Add(byStart.GetValueOrDefault(start));

            // The next hour would wrap past midnight.
            if (start.AddHours(1) <= start)
            {
                break;
            }
        }

        return slots;
    }

    /// <summary>The start of the first entry hour with a missing value, or with no planning hour at all.</summary>
    private static TimeOnly? FirstHourWithoutForecast(ScheduledActivity entry, IReadOnlyList<PlanningHour?> hours)
    {
        for (var index = 0; index < hours.Count; index++)
        {
            if (hours[index] is not { TemperatureC: not null, RainMmPerHour: not null, WindMs: not null })
            {
                return entry.StartTime.AddHours(index);
            }
        }

        return null;
    }

    // Daylight hours are contiguous, so a dark hour inside an entry is always at its start or its end (research
    // section 6). A missing hour is a NoForecast matter, not a daylight one.
    private static void AddDaylightProblems(
        List<PlanProblem> problems,
        ScheduledActivity entry,
        IReadOnlyList<PlanningHour?> hours,
        PlanningDay day)
    {
        if (hours.Count == 0)
        {
            return;
        }

        if (hours[0] is { Daylight: false })
        {
            problems.Add(new PlanProblem(PlanRule.BeforeSunrise, Time: entry.StartTime, SunTime: day.Sunrise));
        }

        if (hours[^1] is { Daylight: false })
        {
            problems.Add(new PlanProblem(PlanRule.AfterSunset, Time: entry.EndTime, SunTime: day.Sunset));
        }
    }

    // The lowest temperature is the worst for Cold; the highest value for every other limit.
    private static bool IsWorse(LimitBreach candidate, LimitBreach kept) =>
        candidate.Rule == PlanRule.Cold ? candidate.Value < kept.Value : candidate.Value > kept.Value;
}
