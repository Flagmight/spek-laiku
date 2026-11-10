using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>One activity's verdicts, periods and counts over the plan dates (spec FR-017, FR-021, FR-022).</summary>
public sealed class ActivityForecastsTests
{
    private static readonly DateOnly Saturday = new(2026, 11, 14);
    private static readonly DateOnly Sunday = new(2026, 11, 15);

    // 15 to 35 °C, rain up to 0.5 mm/h, wind up to 8 m/s, 2 hours, daylight required.
    private static readonly CheckedPlanActivity Kayaking = new(
        Guid.NewGuid(), "Kayaking", ActivityType.Outdoor, 2m, true, 8m, 0.5m, 15m, 35m);

    [Fact]
    public void For_JudgesEveryHourAndCountsAcrossDates()
    {
        // Saturday: warm 10:00–13:00 and 15:00; Sunday: cold all day.
        var days = new[]
        {
            Day(Saturday, hour => hour is >= 10 and < 13 or 15 ? 20m : 5m),
            Day(Sunday, _ => 5m)
        };

        var forecast = ActivityForecasts.For(Kayaking, days);

        Assert.False(forecast.WeatherIndependent);
        Assert.Equal(4, forecast.SuitableHours);
        Assert.Equal(1, forecast.DatesWithSuitableHours);
        Assert.True(forecast.HasLongEnoughPeriod);
        Assert.Equal([Saturday, Sunday], forecast.Days.Select(day => day.Date));
        Assert.Equal(16, forecast.Days[0].Hours.Count);
        Assert.Equal(
            [(10, 3, false), (15, 1, true)],
            forecast.Days[0].Periods.Select(period => (period.Start.Hour, period.LengthHours, period.ShorterThanDuration)));
        Assert.Empty(forecast.Days[1].Periods);
        Assert.Equal(["Too cold: 5.0 °C, minimum 15.0 °C"], forecast.Days[1].Hours[4].Reasons);
    }

    [Fact]
    public void For_EveryPeriodShorterThanTheDuration_HasNoLongEnoughPeriod()
    {
        var days = new[] { Day(Saturday, hour => hour is 10 or 14 ? 20m : 5m) };

        var forecast = ActivityForecasts.For(Kayaking, days);

        Assert.Equal(2, forecast.SuitableHours);
        Assert.False(forecast.HasLongEnoughPeriod);
    }

    [Fact]
    public void For_NoSuitableHour_HasNoLongEnoughPeriodAndZeroCounts()
    {
        var forecast = ActivityForecasts.For(Kayaking, [Day(Saturday, _ => 5m)]);

        Assert.Equal(0, forecast.SuitableHours);
        Assert.Equal(0, forecast.DatesWithSuitableHours);
        Assert.False(forecast.HasLongEnoughPeriod);
    }

    [Fact]
    public void For_TodayWithoutHoursLeft_CountsAsADateWithoutSuitableHours()
    {
        var lateToday = new PlanningDay(Saturday, new TimeOnly(7, 46), new TimeOnly(16, 15), []);

        var forecast = ActivityForecasts.For(Kayaking, [lateToday, Day(Sunday, _ => 20m)]);

        Assert.Empty(forecast.Days[0].Hours);
        Assert.Empty(forecast.Days[0].Periods);
        Assert.Equal(1, forecast.DatesWithSuitableHours);
    }

    [Theory]
    [InlineData(ActivityType.Indoor, false, true)]
    [InlineData(ActivityType.Indoor, true, false)]
    [InlineData(ActivityType.Outdoor, false, false)]
    public void For_OnlyIndoorWithoutDaylight_IsWeatherIndependent(ActivityType type, bool requiresDaylight, bool expected)
    {
        var activity = Kayaking with { Type = type, RequiresDaylight = requiresDaylight };

        Assert.Equal(expected, ActivityForecasts.For(activity, [Day(Saturday, _ => 20m)]).WeatherIndependent);
    }

    [Fact]
    public void For_IndoorWithoutDaylight_FindsEveryHourSuitable()
    {
        var museum = new CheckedPlanActivity(Guid.NewGuid(), "Museum", ActivityType.Indoor, 1.5m, false, null, null, null, null);

        var forecast = ActivityForecasts.For(museum, [Day(Saturday, _ => -20m)]);

        Assert.Equal(16, forecast.SuitableHours);
        var period = Assert.Single(forecast.Days[0].Periods);
        Assert.Equal(16, period.LengthHours);
    }

    // 06:00 to 22:00 with the given temperature, no rain, 3 m/s, and daylight from 08:00 to 16:00.
    private static PlanningDay Day(DateOnly date, Func<int, decimal> temperature) =>
        new(
            date,
            new TimeOnly(7, 46),
            new TimeOnly(16, 15),
            Enumerable.Range(6, 16)
                .Select(hour => new PlanningHour(
                    new TimeOnly(hour, 0),
                    new TimeOnly(hour + 1, 0),
                    temperature(hour),
                    0m,
                    3m,
                    hour is >= 8 and < 16))
                .ToList());
}
