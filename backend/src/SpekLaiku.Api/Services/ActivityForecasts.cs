using SpekLaiku.Api.Entities;

namespace SpekLaiku.Api.Services;

/// <summary>Judges every planning hour for one activity and counts the result (research section 7).</summary>
public static class ActivityForecasts
{
    public static ActivityForecast For(CheckedPlanActivity activity, IReadOnlyList<PlanningDay> days)
    {
        var activityDays = days.Select(day => ForDay(activity, day)).ToList();
        var periods = activityDays.SelectMany(day => day.Periods).ToList();

        return new ActivityForecast(
            activity.Type == ActivityType.Indoor && !activity.RequiresDaylight,
            activityDays.Sum(day => day.Hours.Count(hour => hour.Suitable)),
            activityDays.Count(day => day.Hours.Any(hour => hour.Suitable)),
            periods.Any(period => !period.ShorterThanDuration),
            activityDays);
    }

    private static ActivityDayForecast ForDay(CheckedPlanActivity activity, PlanningDay day)
    {
        var hours = day.Hours
            .Select(hour => new HourSuitability(hour.Start, HourSuitabilityRules.Check(hour, activity)))
            .ToList();

        var periods = SuitablePeriods.From(hours, activity.DurationHours);

        return new ActivityDayForecast(day.Date, periods, SuitablePeriods.Longest(periods), hours);
    }
}
