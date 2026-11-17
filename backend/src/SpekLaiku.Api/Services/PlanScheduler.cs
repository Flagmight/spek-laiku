namespace SpekLaiku.Api.Services;

/// <summary>
/// Assigns each activity in plan order to the longest available non-overlapping suitable period across all
/// plan dates (spec FR-003 to FR-005, research section 3). Activities whose category has no places get
/// <see cref="UnscheduledReason.NoPlace"/>; those with no available slot get
/// <see cref="UnscheduledReason.NoSuitableTime"/>. The assigned slot is the full suitable period
/// (Start → End), so no two scheduled activities on the same date overlap (spec SC-004).
/// </summary>
public static class PlanScheduler
{
    public static (IReadOnlyList<ScheduledActivity> Scheduled, IReadOnlyList<UnscheduledActivity> Unscheduled)
        Assign(
            IReadOnlyList<CheckedPlanActivity> activities,
            IReadOnlyList<ActivityForecast> forecasts,
            IReadOnlyList<CategoryPlaces> categoryPlaces,
            IReadOnlyList<PlanningDay> days)
    {
        var scheduled = new List<ScheduledActivity>();
        var unscheduled = new List<UnscheduledActivity>();
        var occupiedSlots = new Dictionary<DateOnly, List<(TimeOnly Start, TimeOnly End)>>();

        for (var i = 0; i < activities.Count; i++)
        {
            var activity = activities[i];
            var forecast = forecasts[i];

            var categoryEntry = categoryPlaces.FirstOrDefault(cp => cp.CategoryId == activity.CategoryId);
            if (categoryEntry is null || categoryEntry.Places.Count == 0)
            {
                unscheduled.Add(new UnscheduledActivity(activity.Name, UnscheduledReason.NoPlace));
                continue;
            }

            var best = FindBestSlot(forecast.Days, occupiedSlots);
            if (best is null)
            {
                unscheduled.Add(new UnscheduledActivity(activity.Name, UnscheduledReason.NoSuitableTime));
                continue;
            }

            var planningDay = days.First(d => d.Date == best.Value.Date);
            var weather = BuildWeather(forecast.WeatherIndependent, best.Value.Period, planningDay);

            scheduled.Add(new ScheduledActivity(
                activity.CategoryId,
                activity.Name,
                best.Value.Date,
                best.Value.Period.Start,
                best.Value.Period.End,
                categoryEntry.Places[0],
                weather));

            if (!occupiedSlots.TryGetValue(best.Value.Date, out var slots))
            {
                slots = [];
                occupiedSlots[best.Value.Date] = slots;
            }

            slots.Add((best.Value.Period.Start, best.Value.Period.End));
        }

        return (scheduled, unscheduled);
    }

    private static (DateOnly Date, SuitablePeriod Period)?
        FindBestSlot(
            IReadOnlyList<ActivityDayForecast> activityDays,
            Dictionary<DateOnly, List<(TimeOnly Start, TimeOnly End)>> occupiedSlots)
    {
        (DateOnly Date, SuitablePeriod Period)? best = null;

        foreach (var activityDay in activityDays)
        {
            var dayOccupied = occupiedSlots.TryGetValue(activityDay.Date, out var s) ? s : [];

            foreach (var period in activityDay.Periods.OrderByDescending(p => p.LengthHours).ThenBy(p => p.Start))
            {
                if (period.ShorterThanDuration)
                {
                    continue;
                }

                if (Overlaps(period.Start, period.End, dayOccupied))
                {
                    continue;
                }

                // Earliest date wins on a length tie (activityDays are in ascending date order).
                if (best is null || period.LengthHours > best.Value.Period.LengthHours)
                {
                    best = (activityDay.Date, period);
                }

                break; // The longest available period for this date found; no shorter one can beat it.
            }
        }

        return best;
    }

    private static WeatherSnapshot BuildWeather(bool weatherIndependent, SuitablePeriod period, PlanningDay day)
    {
        if (weatherIndependent)
        {
            return new WeatherSnapshot(null, null, null, IsIndoor: true);
        }

        var startHour = day.Hours.FirstOrDefault(h => h.Start == period.Start);
        return new WeatherSnapshot(startHour?.TemperatureC, startHour?.RainMmPerHour, startHour?.WindMs, IsIndoor: false);
    }

    private static bool Overlaps(
        TimeOnly start,
        TimeOnly end,
        IReadOnlyList<(TimeOnly Start, TimeOnly End)> occupied)
    {
        foreach (var slot in occupied)
        {
            if (start < slot.End && slot.Start < end)
            {
                return true;
            }
        }

        return false;
    }
}
