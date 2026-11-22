using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The weather problems of one scheduled activity (feature 012 spec User Story 3, FR-007): the worst value of each
/// broken limit over the activity's hours, the first hour with it, and the rule order.
/// </summary>
public sealed class PlanWeatherRulesTests
{
    private static readonly DateOnly Date = new(2026, 11, 21);

    // Wind up to 8 m/s, rain up to 1 mm/h, 0 to 30 °C, daylight required.
    private static readonly CheckedPlanActivity Kayaking = new(
        Guid.NewGuid(), "Kayaking", ActivityType.Outdoor, 2m, true, 8m, 1m, 0m, 30m);

    private static readonly CheckedPlanActivity Museum = new(
        Guid.NewGuid(), "Museum", ActivityType.Indoor, 2m, false, null, null, null, null);

    // Kayaking on Saturday 10:00–12:00, the spec's example.
    private static readonly ScheduledActivity Entry = new(
        Kayaking.CategoryId,
        "Kayaking",
        Date,
        new TimeOnly(10, 0),
        new TimeOnly(12, 0),
        new NearbyPlace("Lagoon", 54.9, 23.9, 1.0m, null, "node/1"),
        new WeatherSnapshot(10m, 0m, 5m, IsIndoor: false),
        ActivityIndex: 0);

    [Fact]
    public void WindAboveLimitInOneHour_GivesWindAtThatHour()
    {
        var day = Day(Hour(10, wind: 5m), Hour(11, wind: 9m));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.Wind, new TimeOnly(11, 0), 9m, 8m)], problems);
    }

    [Fact]
    public void WindAboveLimitInSeveralHours_GivesTheHighestAndItsFirstHour()
    {
        var entry = Entry with { EndTime = new TimeOnly(14, 0) };
        var day = Day(Hour(10, wind: 9m), Hour(11, wind: 11m), Hour(12, wind: 10m), Hour(13, wind: 11m));

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.Wind, new TimeOnly(11, 0), 11m, 8m)], problems);
    }

    [Fact]
    public void SameWorstValueTwice_GivesTheEarlierHour()
    {
        var day = Day(Hour(10, rain: 2m), Hour(11, rain: 2m));

        var problem = Assert.Single(PlanWeatherRules.For(Entry, Kayaking, day));

        Assert.Equal(new TimeOnly(10, 0), problem.Time);
    }

    [Fact]
    public void RainAboveLimit_GivesRain()
    {
        var day = Day(Hour(10, rain: 0.5m), Hour(11, rain: 1.4m));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.Rain, new TimeOnly(11, 0), 1.4m, 1m)], problems);
    }

    [Fact]
    public void TemperatureBelowMinimum_GivesTheLowestAsCold()
    {
        var day = Day(Hour(10, temperature: -2m), Hour(11, temperature: -4m));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.Cold, new TimeOnly(11, 0), -4m, 0m)], problems);
    }

    [Fact]
    public void TemperatureAboveMaximum_GivesTheHighestAsHeat()
    {
        var day = Day(Hour(10, temperature: 33m), Hour(11, temperature: 31m));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.Heat, new TimeOnly(10, 0), 33m, 30m)], problems);
    }

    [Fact]
    public void ValuesEqualToLimits_GiveNoProblem()
    {
        var day = Day(Hour(10, temperature: 0m, rain: 1m, wind: 8m), Hour(11, temperature: 30m, rain: 1m, wind: 8m));

        Assert.Empty(PlanWeatherRules.For(Entry, Kayaking, day));
    }

    [Fact]
    public void SeveralRulesBroken_AreListedInRuleOrder()
    {
        var day = Day(Hour(10, temperature: -1m, wind: 9m), Hour(11, rain: 3m));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([PlanRule.Wind, PlanRule.Rain, PlanRule.Cold], problems.Select(problem => problem.Rule));
    }

    [Fact]
    public void HoursOutsideTheEntry_AreIgnored()
    {
        var day = Day(Hour(9, wind: 20m), Hour(10), Hour(11), Hour(12, wind: 20m));

        Assert.Empty(PlanWeatherRules.For(Entry, Kayaking, day));
    }

    [Fact]
    public void IndoorActivity_GetsNoWeatherProblem()
    {
        var entry = Entry with { CategoryId = Museum.CategoryId, ActivityName = "Museum" };
        var day = Day(Hour(10, temperature: -20m, rain: 9m, wind: 30m), Hour(11, temperature: 40m));

        Assert.Empty(PlanWeatherRules.For(entry, Museum, day));
    }

    [Fact]
    public void MissingValue_GivesNoForecastAtTheFirstSuchHour()
    {
        var entry = Entry with { EndTime = new TimeOnly(13, 0) };
        var day = Day(Hour(10), Hour(11) with { RainMmPerHour = null }, Hour(12) with { WindMs = null });

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.NoForecast, Time: new TimeOnly(11, 0))], problems);
    }

    [Fact]
    public void MissingHour_GivesNoForecast()
    {
        var day = Day(Hour(10));

        var problems = PlanWeatherRules.For(Entry, Kayaking, day);

        Assert.Equal([new PlanProblem(PlanRule.NoForecast, Time: new TimeOnly(11, 0))], problems);
    }

    [Fact]
    public void IndoorWithMissingValues_GetsNoNoForecast()
    {
        var entry = Entry with { CategoryId = Museum.CategoryId, ActivityName = "Museum" };
        var day = Day(Hour(10) with { TemperatureC = null, RainMmPerHour = null, WindMs = null });

        Assert.Empty(PlanWeatherRules.For(entry, Museum, day));
    }

    [Fact]
    public void StartBeforeSunrise_GivesBeforeSunriseWithBothTimes()
    {
        var entry = Entry with { StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(9, 0) };
        var day = Day(Hour(7) with { Daylight = false }, Hour(8));

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal(
            [new PlanProblem(PlanRule.BeforeSunrise, Time: new TimeOnly(7, 0), SunTime: new TimeOnly(7, 30))],
            problems);
    }

    [Fact]
    public void EndAfterSunset_GivesAfterSunsetWithBothTimes()
    {
        var entry = Entry with { StartTime = new TimeOnly(15, 0), EndTime = new TimeOnly(17, 0) };
        var day = Day(Hour(15), Hour(16) with { Daylight = false });

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal(
            [new PlanProblem(PlanRule.AfterSunset, Time: new TimeOnly(17, 0), SunTime: new TimeOnly(16, 30))],
            problems);
    }

    [Fact]
    public void BothEndsOutsideDaylight_GivesBoth()
    {
        var entry = Entry with { StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(17, 0) };
        var day = Day(
            [.. Enumerable.Range(7, 10).Select(hour => Hour(hour) with { Daylight = hour is not 7 and not 16 })]);

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal([PlanRule.BeforeSunrise, PlanRule.AfterSunset], problems.Select(problem => problem.Rule));
    }

    [Fact]
    public void IndoorRequiringDaylight_GetsDaylightProblemsOnly()
    {
        var gallery = Museum with { RequiresDaylight = true };
        var entry = Entry with { StartTime = new TimeOnly(15, 0), EndTime = new TimeOnly(17, 0) };
        var day = Day(Hour(15, wind: 30m), Hour(16, rain: 9m) with { Daylight = false, TemperatureC = null });

        var problems = PlanWeatherRules.For(entry, gallery, day);

        Assert.Equal([PlanRule.AfterSunset], problems.Select(problem => problem.Rule));
    }

    [Fact]
    public void ActivityNotRequiringDaylight_GetsNoDaylightProblem()
    {
        var nightKayaking = Kayaking with { RequiresDaylight = false };
        var day = Day(Hour(10) with { Daylight = false }, Hour(11) with { Daylight = false });

        Assert.Empty(PlanWeatherRules.For(Entry, nightKayaking, day));
    }

    [Fact]
    public void AllRules_AreInRuleOrder()
    {
        var entry = Entry with { StartTime = new TimeOnly(7, 0), EndTime = new TimeOnly(10, 0) };
        var day = Day(
            Hour(7, temperature: 35m, rain: 2m, wind: 9m) with { Daylight = false },
            Hour(8) with { WindMs = null },
            Hour(9) with { Daylight = false });

        var problems = PlanWeatherRules.For(entry, Kayaking, day);

        Assert.Equal(
            [PlanRule.Wind, PlanRule.Rain, PlanRule.Heat, PlanRule.NoForecast, PlanRule.BeforeSunrise, PlanRule.AfterSunset],
            problems.Select(problem => problem.Rule));
    }

    private static PlanningHour Hour(int start, decimal temperature = 10m, decimal rain = 0m, decimal wind = 3m) =>
        new(new TimeOnly(start, 0), new TimeOnly(start + 1, 0), temperature, rain, wind, Daylight: true);

    private static PlanningDay Day(params PlanningHour[] hours) =>
        new(Date, new TimeOnly(7, 30), new TimeOnly(16, 30), hours);
}
