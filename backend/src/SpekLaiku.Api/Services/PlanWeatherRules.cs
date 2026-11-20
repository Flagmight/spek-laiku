namespace SpekLaiku.Api.Services;

/// <summary>
/// The weather problems of one scheduled activity against the latest forecast (feature 012 spec FR-005, FR-007,
/// research section 5). The comparisons are <see cref="HourSuitabilityRules.Breaches"/>, the ones the schedule
/// was made with, so a plan whose forecast has not changed has no problem. Each broken limit is given once, with
/// its worst value over the activity's hours and the first hour that has it.
/// </summary>
public static class PlanWeatherRules
{
    /// <param name="entry">The scheduled activity, as saved.</param>
    /// <param name="activity">Its activity, with its own saved limits.</param>
    /// <param name="day">The latest planning hours of the entry's date.</param>
    public static IReadOnlyList<PlanProblem> For(ScheduledActivity entry, CheckedPlanActivity activity, PlanningDay day)
    {
        var worst = new Dictionary<PlanRule, (LimitBreach Breach, TimeOnly Time)>();

        foreach (var hour in HoursOf(entry, day))
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

        return worst
            .OrderBy(pair => pair.Key)
            .Select(pair => new PlanProblem(
                pair.Key,
                Time: pair.Value.Time,
                Value: pair.Value.Breach.Value,
                Limit: pair.Value.Breach.Limit))
            .ToList();
    }

    /// <summary>The planning hours that lie within the entry's time, in time order.</summary>
    private static IEnumerable<PlanningHour> HoursOf(ScheduledActivity entry, PlanningDay day) =>
        day.Hours.Where(hour => hour.Start >= entry.StartTime && hour.End <= entry.EndTime);

    // The lowest temperature is the worst for Cold; the highest value for every other limit.
    private static bool IsWorse(LimitBreach candidate, LimitBreach kept) =>
        candidate.Rule == PlanRule.Cold ? candidate.Value < kept.Value : candidate.Value > kept.Value;
}
