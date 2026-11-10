using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The planning hours of each plan date (spec FR-010, FR-011, FR-016, FR-018; research sections 2, 3 and 5),
/// built from hand-made forecasts with values stamped every hour in UTC.
/// </summary>
public sealed class PlanningDaysTests
{
    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById("Europe/Vilnius");
    private static readonly DateOnly Saturday = new(2026, 11, 14);
    private static readonly ForecastOptions Defaults = new();

    // Long before every plan date, so no hour counts as started.
    private static readonly DateTimeOffset LongAgo = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Build_GivesTheSixteenHoursFrom6To22WithTheirEnds()
    {
        var day = Assert.Single(PlanningDays.Build(Forecast(Saturday, 1), [Saturday], LongAgo, Defaults));

        Assert.Equal(Saturday, day.Date);
        Assert.Equal(16, day.Hours.Count);
        Assert.Equal(new TimeOnly(6, 0), day.Hours[0].Start);
        Assert.Equal(new TimeOnly(7, 0), day.Hours[0].End);
        Assert.Equal(new TimeOnly(21, 0), day.Hours[^1].Start);
        Assert.Equal(new TimeOnly(22, 0), day.Hours[^1].End);
    }

    [Fact]
    public void Build_UsesTheConfiguredWindow()
    {
        var options = new ForecastOptions { FirstHour = 8, LastHour = 11 };

        var day = Assert.Single(PlanningDays.Build(Forecast(Saturday, 1), [Saturday], LongAgo, options));

        Assert.Equal([8, 9, 10], day.Hours.Select(hour => hour.Start.Hour));
    }

    [Fact]
    public void Build_GivesOneDayPerDateInDateOrder()
    {
        var tuesday = Saturday.AddDays(3);

        var days = PlanningDays.Build(Forecast(Saturday, 4), [tuesday, Saturday], LongAgo, Defaults);

        Assert.Equal([Saturday, tuesday], days.Select(day => day.Date));
    }

    [Theory]
    [InlineData(14, 20, 15)]
    [InlineData(14, 0, 15)]
    [InlineData(5, 59, 6)]
    public void Build_LeavesOutTodaysHoursThatHaveStarted(int hour, int minute, int firstHour)
    {
        var sunday = Saturday.AddDays(1);

        var days = PlanningDays.Build(Forecast(Saturday, 2), [Saturday, sunday], Local(Saturday, hour, minute), Defaults);

        Assert.Equal(firstHour, days[0].Hours[0].Start.Hour);
        Assert.Equal(16, days[1].Hours.Count);
    }

    [Fact]
    public void Build_LateInTheEvening_LeavesTodayWithoutHours()
    {
        var day = Assert.Single(PlanningDays.Build(Forecast(Saturday, 1), [Saturday], Local(Saturday, 21, 30), Defaults));

        Assert.Empty(day.Hours);
        Assert.Equal(new TimeOnly(7, 42), day.Sunrise);
    }

    [Fact]
    public void Build_TakesTemperatureAndWindFromTheStartAndRainFromTheEndOfTheHour()
    {
        var forecast = Forecast(Saturday, 1, values: time => time == Local(Saturday, 12, 0)
            ? (16.4, 0.0, 9.0)
            : time == Local(Saturday, 13, 0) ? (17.0, 1.2, 4.0) : (10.0, 0.0, 2.0));

        var noon = Hour(PlanningDays.Build(forecast, [Saturday], LongAgo, Defaults)[0], 12);

        Assert.Equal(16.4m, noon.TemperatureC);
        Assert.Equal(9.0m, noon.WindMs);
        Assert.Equal(1.2m, noon.RainMmPerHour);
    }

    [Fact]
    public void Build_MissingEntriesAndValues_AreNull()
    {
        var missing = Local(Saturday, 10, 0);
        var forecast = Forecast(Saturday, 1, values: time => time == Local(Saturday, 15, 0)
            ? (null, null, null)
            : (10.0, 0.0, 2.0));
        forecast = forecast with { Hours = forecast.Hours.Where(hour => hour.Time != missing).ToList() };

        var day = PlanningDays.Build(forecast, [Saturday], LongAgo, Defaults)[0];

        // 10:00 is missing: the 10:00 hour has no temperature or wind, the 09:00 hour no rain.
        Assert.Null(Hour(day, 10).TemperatureC);
        Assert.Null(Hour(day, 10).WindMs);
        Assert.Equal(0.0m, Hour(day, 10).RainMmPerHour);
        Assert.Null(Hour(day, 9).RainMmPerHour);
        Assert.Equal(10.0m, Hour(day, 9).TemperatureC);
        Assert.Null(Hour(day, 15).TemperatureC);
        Assert.Null(Hour(day, 14).RainMmPerHour);
    }

    [Theory]
    [InlineData(15.04, "15.0")]
    [InlineData(15.05, "15.1")]
    [InlineData(-0.05, "-0.1")]
    [InlineData(0.0, "0.0")]
    [InlineData(-0.04, "0.0")]
    [InlineData(8.0, "8.0")]
    public void Build_RoundsEachValueOnceToOneDecimalPlace(double value, string expected)
    {
        var forecast = Forecast(Saturday, 1, values: _ => (value, value, value));

        var hour = PlanningDays.Build(forecast, [Saturday], LongAgo, Defaults)[0].Hours[0];

        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), hour.TemperatureC);
        Assert.Equal(expected, hour.TemperatureC!.Value.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture));
        Assert.Equal(hour.TemperatureC, hour.RainMmPerHour);
        Assert.Equal(hour.TemperatureC, hour.WindMs);
    }

    [Fact]
    public void Build_CountsOnlyHoursFullyBetweenSunriseAndSunsetAsDaylight()
    {
        var day = PlanningDays.Build(Forecast(Saturday, 1), [Saturday], LongAgo, Defaults)[0];

        // Sunrise 07:42, sunset 16:20.
        Assert.False(Hour(day, 7).Daylight);
        Assert.True(Hour(day, 8).Daylight);
        Assert.True(Hour(day, 15).Daylight);
        Assert.False(Hour(day, 16).Daylight);
        Assert.False(Hour(day, 6).Daylight);
    }

    [Fact]
    public void Build_SunsetExactlyAtTheEndOfAnHour_KeepsThatHourInDaylight()
    {
        var forecast = Forecast(Saturday, 1, sunrise: new TimeOnly(8, 0), sunset: new TimeOnly(16, 0));

        var day = PlanningDays.Build(forecast, [Saturday], LongAgo, Defaults)[0];

        Assert.True(Hour(day, 8).Daylight);
        Assert.True(Hour(day, 15).Daylight);
        Assert.False(Hour(day, 16).Daylight);
    }

    [Fact]
    public void Build_ShowsSunriseAndSunsetToTheMinute()
    {
        var forecast = Forecast(Saturday, 1, sunrise: new TimeOnly(7, 42, 59), sunset: new TimeOnly(16, 20, 1));

        var day = PlanningDays.Build(forecast, [Saturday], LongAgo, Defaults)[0];

        Assert.Equal(new TimeOnly(7, 42), day.Sunrise);
        Assert.Equal(new TimeOnly(16, 20), day.Sunset);
    }

    [Theory]
    // Summer time starts on 2027-03-28 (06:00 local is 03:00 UTC); it ends on 2027-10-31 (06:00 local is 04:00 UTC).
    [InlineData("2027-03-28", 3)]
    [InlineData("2027-10-31", 4)]
    public void Build_OnClockChangeDays_GivesEveryHourOnceAtTheRightInstant(string date, int utcHourOfFirstHour)
    {
        var day = DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture);
        // Each value is the UTC hour of its stamp, so the instant used can be read back.
        var forecast = Forecast(day.AddDays(-1), 3, values: time => (time.UtcDateTime.Hour, 0.0, 0.0));

        var built = PlanningDays.Build(forecast, [day], LongAgo, Defaults)[0];

        Assert.Equal(16, built.Hours.Count);
        Assert.Equal(16, built.Hours.Select(hour => hour.Start).Distinct().Count());
        Assert.Equal((decimal)utcHourOfFirstHour, built.Hours[0].TemperatureC);
        Assert.Equal((decimal)(utcHourOfFirstHour + 15), built.Hours[^1].TemperatureC);
    }

    private static PlanningHour Hour(PlanningDay day, int startHour) =>
        day.Hours.Single(hour => hour.Start.Hour == startHour);

    private static DateTimeOffset Local(DateOnly date, int hour, int minute)
    {
        var local = date.ToDateTime(new TimeOnly(hour, minute));
        return new DateTimeOffset(local, Lithuania.GetUtcOffset(local));
    }

    /// <summary>
    /// Values stamped every hour in UTC from the first date's local midnight until a day after the last date,
    /// with 10 °C, no rain and 2 m/s unless <paramref name="values"/> says otherwise, and the given daylight.
    /// </summary>
    private static HourlyForecast Forecast(
        DateOnly firstDate,
        int days,
        Func<DateTimeOffset, (double? Temperature, double? Rain, double? Wind)>? values = null,
        TimeOnly? sunrise = null,
        TimeOnly? sunset = null)
    {
        values ??= _ => (10.0, 0.0, 2.0);
        var start = Local(firstDate, 0, 0).ToUniversalTime();
        var end = Local(firstDate.AddDays(days + 1), 0, 0).ToUniversalTime();
        var hours = new List<ForecastHourValues>();
        for (var time = start; time < end; time = time.AddHours(1))
        {
            var (temperature, rain, wind) = values(time);
            hours.Add(new ForecastHourValues(time, temperature, rain, wind));
        }

        var rise = sunrise ?? new TimeOnly(7, 42);
        var set = sunset ?? new TimeOnly(16, 20);
        var daylight = Enumerable.Range(0, days)
            .Select(offset => firstDate.AddDays(offset))
            .Select(date => new ForecastDaylight(date, Local(date, 0, 0) + rise.ToTimeSpan(), Local(date, 0, 0) + set.ToTimeSpan()))
            .ToList();

        return new HourlyForecast(hours, daylight);
    }
}
