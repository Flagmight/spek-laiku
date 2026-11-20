using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Checking every scheduled activity of a saved plan (feature 012 spec FR-005, FR-006, FR-011, data-model.md):
/// the stored order, started activities, the latest weather and finding each entry's own limits.
/// </summary>
public sealed class PlanCheckRulesTests
{
    private static readonly DateOnly Date = new(2026, 11, 21);
    private static readonly DateOnly OtherDate = new(2026, 11, 22);

    // 09:00 on 2026-11-20 in Vilnius (UTC+2).
    private static readonly DateTimeOffset Now = new(2026, 11, 20, 9, 0, 0, TimeSpan.FromHours(2));

    private static readonly Guid CyclingId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid MuseumId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    private static readonly CheckedPlanActivity StrictCycling = new(
        CyclingId, "Cycling", ActivityType.Outdoor, 2m, false, 5m, 1m, 0m, 30m);

    private static readonly CheckedPlanActivity RelaxedCycling = StrictCycling with { MaxWindMs = 10m };

    private static readonly CheckedPlanActivity Museum = new(
        MuseumId, "Museum", ActivityType.Indoor, 2m, false, null, null, null, null);

    [Fact]
    public void Entries_AreReturnedInTheStoredOrder_OnePerScheduledActivity()
    {
        var snapshot = Snapshot(
            [StrictCycling, Museum],
            Entry(1, Museum, Date, 9),
            Entry(0, StrictCycling, Date, 13),
            Entry(1, Museum, OtherDate, 10));

        var entries = PlanCheckRules.Check(snapshot, [Day(Date), Day(OtherDate)], Now);

        Assert.Equal(
            [(Date, new TimeOnly(9, 0)), (Date, new TimeOnly(13, 0)), (OtherDate, new TimeOnly(10, 0))],
            entries.Select(entry => (entry.Date, entry.StartTime)));
        Assert.Equal(["Museum", "Cycling", "Museum"], entries.Select(entry => entry.ActivityName));
    }

    [Fact]
    public void CheckedEntry_GetsTheLatestWeatherAtItsStartHour()
    {
        var snapshot = Snapshot([RelaxedCycling], Entry(0, RelaxedCycling, Date, 10));
        var day = Day(Date, Hour(10, temperature: 6.5m, rain: 0.2m, wind: 7.2m), Hour(11, wind: 2m));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [day], Now));

        Assert.False(entry.Past);
        Assert.Equal(new WeatherSnapshot(6.5m, 0.2m, 7.2m, IsIndoor: false), entry.Weather);
        Assert.Empty(entry.Problems);
    }

    [Fact]
    public void IndoorEntryWithoutDaylight_GetsIsIndoorWeather()
    {
        var snapshot = Snapshot([Museum], Entry(0, Museum, Date, 10));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [Day(Date)], Now));

        Assert.Equal(new WeatherSnapshot(null, null, null, IsIndoor: true), entry.Weather);
    }

    [Fact]
    public void WindProblem_IsReturnedOnTheEntry()
    {
        var snapshot = Snapshot([StrictCycling], Entry(0, StrictCycling, Date, 10));
        var day = Day(Date, Hour(10), Hour(11, wind: 7m));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [day], Now));

        Assert.Equal([new PlanProblem(PlanRule.Wind, new TimeOnly(11, 0), 7m, 5m)], entry.Problems);
    }

    [Fact]
    public void ActivityIndex_PicksTheRightLimitsForARepeatedCategory()
    {
        // Cycling twice: limits 5 and 10 m/s, and 7 m/s wind on both dates.
        var snapshot = Snapshot(
            [StrictCycling, RelaxedCycling],
            Entry(0, StrictCycling, Date, 10),
            Entry(1, RelaxedCycling, OtherDate, 10));
        var windy = new[] { Hour(10, wind: 7m), Hour(11, wind: 7m) };

        var entries = PlanCheckRules.Check(snapshot, [Day(Date, windy), Day(OtherDate, windy)], Now);

        Assert.Single(entries[0].Problems);
        Assert.Empty(entries[1].Problems);
    }

    [Fact]
    public void MissingActivityIndex_FallsBackToTheFirstActivityOfTheCategory()
    {
        // A plan saved before feature 012: the relaxed copy comes first, so its limits apply to both entries.
        var snapshot = Snapshot(
            [RelaxedCycling, StrictCycling],
            Entry(null, StrictCycling, Date, 10));
        var day = Day(Date, Hour(10, wind: 7m), Hour(11, wind: 7m));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [day], Now));

        Assert.Empty(entry.Problems);
    }

    [Theory]
    [InlineData(5)]
    [InlineData(-1)]
    [InlineData(1)] // The Museum, another category.
    public void InvalidActivityIndex_FallsBackToTheFirstActivityOfTheCategory(int index)
    {
        var snapshot = Snapshot([StrictCycling, Museum], Entry(index, StrictCycling, Date, 10));
        var day = Day(Date, Hour(10, wind: 7m), Hour(11, wind: 7m));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [day], Now));

        Assert.Equal(PlanRule.Wind, Assert.Single(entry.Problems).Rule);
    }

    [Fact]
    public void ActivityNotInThePlan_IsCheckedAsIndoorWithoutLimits()
    {
        var snapshot = Snapshot([Museum], Entry(null, StrictCycling, Date, 10));
        var day = Day(Date, Hour(10, wind: 30m), Hour(11, wind: 30m));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [day], Now));

        Assert.False(entry.Past);
        Assert.Empty(entry.Problems);
        Assert.True(entry.Weather!.IsIndoor);
    }

    [Fact]
    public void EntryStartingAtNow_IsPast()
    {
        var today = DateOnly.FromDateTime(Now.DateTime);
        var snapshot = Snapshot([StrictCycling], Entry(0, StrictCycling, today, 9));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [Day(today)], Now));

        Assert.True(entry.Past);
        Assert.Null(entry.Weather);
        Assert.Empty(entry.Problems);
    }

    [Fact]
    public void EntryStartingOneMinuteAfterNow_IsChecked()
    {
        var today = DateOnly.FromDateTime(Now.DateTime);
        var snapshot = Snapshot([StrictCycling], Entry(0, StrictCycling, today, 9));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [Day(today)], Now.AddMinutes(-1)));

        Assert.False(entry.Past);
        Assert.NotNull(entry.Weather);
    }

    [Fact]
    public void DateMissingFromTheForecast_IsPast()
    {
        var snapshot = Snapshot([StrictCycling], Entry(0, StrictCycling, Date, 10));

        var entry = Assert.Single(PlanCheckRules.Check(snapshot, [], Now));

        Assert.True(entry.Past);
    }

    private static ScheduledActivity Entry(int? activityIndex, CheckedPlanActivity activity, DateOnly date, int startHour) =>
        new(
            activity.CategoryId,
            activity.Name,
            date,
            new TimeOnly(startHour, 0),
            new TimeOnly(startHour + 2, 0),
            new NearbyPlace($"{activity.Name} place", 54.9, 23.9, 1.0m, null, "node/1"),
            new WeatherSnapshot(1m, 0m, 1m, IsIndoor: false),
            ActivityIndex: activityIndex);

    private static PlanSnapshot Snapshot(IReadOnlyList<CheckedPlanActivity> activities, params ScheduledActivity[] scheduled) =>
        new(
            new CheckedPlanSetup(new PlaceLocation(1, "Kaunas", "Kaunas County", 54.9, 23.9), [Date, OtherDate], 30),
            activities,
            new PlanSchedule(scheduled, [], new TravelSummary(30, 0)));

    private static PlanningHour Hour(int start, decimal temperature = 10m, decimal rain = 0m, decimal wind = 3m) =>
        new(new TimeOnly(start, 0), new TimeOnly(start + 1, 0), temperature, rain, wind, Daylight: true);

    // A date with calm hours from 06:00 to 22:00, unless other hours are given.
    private static PlanningDay Day(DateOnly date, params PlanningHour[] hours) =>
        new(
            date,
            new TimeOnly(7, 30),
            new TimeOnly(16, 30),
            hours.Length > 0 ? hours : [.. Enumerable.Range(6, 16).Select(hour => Hour(hour))]);
}
