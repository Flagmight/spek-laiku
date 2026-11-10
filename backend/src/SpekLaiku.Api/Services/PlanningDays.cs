using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Builds the planning hours of each plan date from the weather service's answer (research sections 2, 3
/// and 5). The hour HH:00 to HH+1:00 uses the temperature and wind stamped at its start and the
/// precipitation stamped at its end, which is the rain that falls during it. Lithuania changes the clocks
/// at 03:00 and 04:00, outside the planning window, so every planning hour exists exactly once.
/// </summary>
public static class PlanningDays
{
    private static TimeZoneInfo Lithuania => ForecastPeriod.Lithuania;

    /// <param name="now">The current time; hours of today that start at or before it are left out.</param>
    public static IReadOnlyList<PlanningDay> Build(
        HourlyForecast forecast,
        IReadOnlyList<DateOnly> dates,
        DateTimeOffset now,
        ForecastOptions options)
    {
        var values = new Dictionary<DateTimeOffset, ForecastHourValues>();
        foreach (var hour in forecast.Hours)
        {
            values.TryAdd(hour.Time, hour);
        }

        var daylight = forecast.Days.ToDictionary(day => day.Date);

        return dates
            .Order()
            .Select(date => BuildDay(date, values, Daylight(daylight, date), now, options))
            .ToList();
    }

    private static PlanningDay BuildDay(
        DateOnly date,
        Dictionary<DateTimeOffset, ForecastHourValues> values,
        ForecastDaylight daylight,
        DateTimeOffset now,
        ForecastOptions options)
    {
        var hours = new List<PlanningHour>();
        for (var hour = options.FirstHour; hour < options.LastHour; hour++)
        {
            var start = LocalInstant(date, hour);
            if (start <= now)
            {
                continue;
            }

            var end = start.AddHours(1);
            var atStart = values.GetValueOrDefault(start);
            var atEnd = values.GetValueOrDefault(end);
            hours.Add(new PlanningHour(
                new TimeOnly(hour, 0),
                new TimeOnly(hour + 1, 0),
                Round(atStart?.TemperatureC),
                Round(atEnd?.PrecipitationMm),
                Round(atStart?.WindSpeedMs),
                start >= daylight.Sunrise && end <= daylight.Sunset));
        }

        return new PlanningDay(date, ToMinute(daylight.Sunrise), ToMinute(daylight.Sunset), hours);
    }

    // The client refuses an answer without the daylight of a requested date, so this cannot happen.
    private static ForecastDaylight Daylight(Dictionary<DateOnly, ForecastDaylight> daylight, DateOnly date) =>
        daylight.TryGetValue(date, out var day)
            ? day
            : throw new InvalidOperationException($"The forecast has no sunrise or sunset for {date:yyyy-MM-dd}.");

    private static DateTimeOffset LocalInstant(DateOnly date, int hour)
    {
        var local = date.ToDateTime(new TimeOnly(hour, 0));
        return new DateTimeOffset(local, Lithuania.GetUtcOffset(local));
    }

    // Rounded once, so the value that is shown is the value that is compared (research section 5).
    // A value such as -0.04 rounds to a negative zero, which is written as plain zero so it never shows as "-0.0".
    private static decimal? Round(double? value)
    {
        if (value is not { } number)
        {
            return null;
        }

        var rounded = Math.Round((decimal)number, 1, MidpointRounding.AwayFromZero);
        return rounded == 0m ? 0.0m : rounded;
    }

    private static TimeOnly ToMinute(DateTimeOffset instant)
    {
        var local = TimeZoneInfo.ConvertTime(instant, Lithuania);
        return new TimeOnly(local.Hour, local.Minute);
    }
}
