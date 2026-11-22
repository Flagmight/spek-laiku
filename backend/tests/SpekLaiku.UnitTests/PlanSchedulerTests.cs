using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Greedy scheduling algorithm: slot selection, overlap prevention and weather snapshot (spec FR-003 to FR-006, SC-002 to SC-004, research section 3).</summary>
public sealed class PlanSchedulerTests
{
    private static readonly DateOnly Date1 = new(2026, 11, 14);
    private static readonly DateOnly Date2 = new(2026, 11, 15);

    private static readonly Guid CategoryA = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid CategoryB = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");

    private static readonly NearbyPlace PlaceA = new("Place A", 54.9, 23.9, 1.0m, null, "k:1");
    private static readonly NearbyPlace PlaceB = new("Place B", 54.8, 23.8, 2.0m, null, "k:2");

    // --- helpers ---

    private static CheckedPlanActivity Activity(string name, Guid categoryId, int durationHours = 2) =>
        new(categoryId, name, ActivityType.Outdoor, durationHours, false, 10m, 1m, 5m, null);

    private static CheckedPlanActivity IndoorActivity(string name, Guid categoryId) =>
        new(categoryId, name, ActivityType.Indoor, 2, false, null, null, null, null);

    private static CategoryPlaces WithPlace(Guid categoryId, NearbyPlace place) =>
        new(categoryId, [place]);

    private static CategoryPlaces NoPlaces(Guid categoryId) =>
        new(categoryId, []);

    // Build an ActivityForecast with one suitable period per date.
    private static ActivityForecast Forecast(bool weatherIndependent, params (DateOnly Date, TimeOnly Start, TimeOnly End)[] slots)
    {
        var days = slots
            .Select(s =>
            {
                var lengthHours = (int)(s.End - s.Start).TotalHours;
                var period = new SuitablePeriod(s.Start, s.End, lengthHours, ShorterThanDuration: false);
                return new ActivityDayForecast(s.Date, [period], period, []);
            })
            .ToList();
        return new ActivityForecast(weatherIndependent, 0, 0, true, days);
    }

    private static ActivityForecast NoSuitablePeriods(DateOnly date) =>
        new(false, 0, 0, false, [new ActivityDayForecast(date, [], null, [])]);

    // Build a PlanningDay with one specific hour that has weather values.
    private static PlanningDay DayWithHour(DateOnly date, TimeOnly start, decimal temp, decimal rain, decimal wind)
    {
        var hours = new List<PlanningHour>
        {
            new(start, new TimeOnly(start.Hour + 1, 0), temp, rain, wind, Daylight: true)
        };
        return new PlanningDay(date, new TimeOnly(7, 0), new TimeOnly(19, 0), hours);
    }

    private static PlanningDay EmptyDay(DateOnly date) =>
        new(date, new TimeOnly(7, 0), new TimeOnly(19, 0), []);

    // --- tests ---

    [Fact]
    public void Assign_AllActivitiesHaveUniquePeriods_AllScheduled()
    {
        var actA = Activity("Kayaking", CategoryA);
        var actB = Activity("Museum", CategoryB);
        var forecastA = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var forecastB = Forecast(false, (Date2, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var days = new[] { DayWithHour(Date1, new TimeOnly(10, 0), 20m, 0m, 3m), DayWithHour(Date2, new TimeOnly(10, 0), 18m, 0.1m, 2m) };
        var places = new[] { WithPlace(CategoryA, PlaceA), WithPlace(CategoryB, PlaceB) };

        var (scheduled, unscheduled) = PlanScheduler.Assign([actA, actB], [forecastA, forecastB], places, days);

        Assert.Equal(2, scheduled.Count);
        Assert.Empty(unscheduled);
        Assert.Equal("Kayaking", scheduled[0].ActivityName);
        Assert.Equal(Date1, scheduled[0].Date);
        Assert.Equal("Museum", scheduled[1].ActivityName);
        Assert.Equal(Date2, scheduled[1].Date);
    }

    [Fact]
    public void Assign_TwoActivitiesCompeteForSameSlot_FirstInPlanOrderWins()
    {
        var actA = Activity("Kayaking", CategoryA);
        var actB = Activity("Cycling", CategoryA);
        var period = (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0));
        var places = new[] { WithPlace(CategoryA, PlaceA) };
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, unscheduled) = PlanScheduler.Assign(
            [actA, actB],
            [Forecast(false, period), Forecast(false, period)],
            places,
            days);

        Assert.Single(scheduled);
        Assert.Equal("Kayaking", scheduled[0].ActivityName);
        Assert.Single(unscheduled);
        Assert.Equal("Cycling", unscheduled[0].ActivityName);
        Assert.Equal(UnscheduledReason.NoSuitableTime, unscheduled[0].Reason);
    }

    [Fact]
    public void Assign_MultiplesDates_AssignsToDateWithLongestPeriod()
    {
        var act = Activity("Kayaking", CategoryA);
        // Date1 has a 2h period, Date2 has a 4h period.
        var forecast = Forecast(
            false,
            (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)),
            (Date2, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var days = new[] { EmptyDay(Date1), EmptyDay(Date2) };

        var (scheduled, unscheduled) = PlanScheduler.Assign([act], [forecast], [WithPlace(CategoryA, PlaceA)], days);

        Assert.Single(scheduled);
        Assert.Equal(Date2, scheduled[0].Date);
        Assert.Empty(unscheduled);
    }

    [Fact]
    public void Assign_EqualLengthPeriodsOnTwoDates_EarlierDateWins()
    {
        var act = Activity("Kayaking", CategoryA);
        var forecast = Forecast(
            false,
            (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0)),
            (Date2, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var days = new[] { EmptyDay(Date1), EmptyDay(Date2) };

        var (scheduled, _) = PlanScheduler.Assign([act], [forecast], [WithPlace(CategoryA, PlaceA)], days);

        Assert.Equal(Date1, scheduled[0].Date);
    }

    [Fact]
    public void Assign_NearestPlaceIsFirstInCategoryList_AssignsFirstPlace()
    {
        var act = Activity("Kayaking", CategoryA);
        var forecast = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)));
        var categoryWithTwoPlaces = new CategoryPlaces(CategoryA, [PlaceA, PlaceB]);
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, _) = PlanScheduler.Assign([act], [forecast], [categoryWithTwoPlaces], days);

        Assert.Equal(PlaceA.Name, scheduled[0].Place.Name);
    }

    [Fact]
    public void Assign_CategoryHasNoPlaces_ReturnsNoPlace()
    {
        var act = Activity("Kayaking", CategoryA);
        var forecast = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)));
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, unscheduled) = PlanScheduler.Assign([act], [forecast], [NoPlaces(CategoryA)], days);

        Assert.Empty(scheduled);
        Assert.Single(unscheduled);
        Assert.Equal(UnscheduledReason.NoPlace, unscheduled[0].Reason);
    }

    [Fact]
    public void Assign_NoCategoryPlacesEntry_ReturnsNoPlace()
    {
        var act = Activity("Kayaking", CategoryA);
        var forecast = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)));
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, unscheduled) = PlanScheduler.Assign([act], [forecast], [], days);

        Assert.Empty(scheduled);
        Assert.Equal(UnscheduledReason.NoPlace, unscheduled[0].Reason);
    }

    [Fact]
    public void Assign_AllSlotsOccupied_ReturnsNoSuitableTime()
    {
        var actA = Activity("Kayaking", CategoryA, durationHours: 4);
        var actB = Activity("Cycling", CategoryB, durationHours: 2);
        var period = (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0));
        var days = new[] { EmptyDay(Date1) };

        // Both activities have only one period on only one date, and it's the same period.
        var (scheduled, unscheduled) = PlanScheduler.Assign(
            [actA, actB],
            [Forecast(false, period), Forecast(false, period)],
            [WithPlace(CategoryA, PlaceA), WithPlace(CategoryB, PlaceB)],
            days);

        Assert.Single(scheduled);
        Assert.Equal("Kayaking", scheduled[0].ActivityName);
        Assert.Single(unscheduled);
        Assert.Equal(UnscheduledReason.NoSuitableTime, unscheduled[0].Reason);
    }

    [Fact]
    public void Assign_IndoorActivity_IsIndoorTrueAndWeatherNull()
    {
        var act = IndoorActivity("Museum", CategoryA);
        var forecast = Forecast(true, (Date1, new TimeOnly(6, 0), new TimeOnly(22, 0)));
        var days = new[] { DayWithHour(Date1, new TimeOnly(6, 0), 20m, 0.5m, 3m) };

        var (scheduled, _) = PlanScheduler.Assign([act], [forecast], [WithPlace(CategoryA, PlaceA)], days);

        Assert.True(scheduled[0].Weather.IsIndoor);
        Assert.Null(scheduled[0].Weather.TemperatureC);
        Assert.Null(scheduled[0].Weather.RainMmPerHour);
        Assert.Null(scheduled[0].Weather.WindMs);
    }

    [Fact]
    public void Assign_OutdoorActivity_WeatherFromPlanningHourAtPeriodStart()
    {
        var act = Activity("Kayaking", CategoryA);
        var forecast = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)));
        var days = new[] { DayWithHour(Date1, new TimeOnly(10, 0), 18.5m, 0.2m, 4.1m) };

        var (scheduled, _) = PlanScheduler.Assign([act], [forecast], [WithPlace(CategoryA, PlaceA)], days);

        var weather = scheduled[0].Weather;
        Assert.False(weather.IsIndoor);
        Assert.Equal(18.5m, weather.TemperatureC);
        Assert.Equal(0.2m, weather.RainMmPerHour);
        Assert.Equal(4.1m, weather.WindMs);
    }

    [Fact]
    public void Assign_NoSuitablePeriods_ReturnsNoSuitableTime()
    {
        var act = Activity("Kayaking", CategoryA);
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, unscheduled) = PlanScheduler.Assign(
            [act],
            [NoSuitablePeriods(Date1)],
            [WithPlace(CategoryA, PlaceA)],
            days);

        Assert.Empty(scheduled);
        Assert.Equal(UnscheduledReason.NoSuitableTime, unscheduled[0].Reason);
    }

    [Fact]
    public void Assign_ScheduledActivitiesOnSameDate_DoNotOverlap()
    {
        // Two activities, each needing 2h, on one date with adjacent non-overlapping periods.
        var actA = Activity("Kayaking", CategoryA, durationHours: 2);
        var actB = Activity("Cycling", CategoryB, durationHours: 2);
        var forecastA = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(12, 0)));
        var forecastB = Forecast(false, (Date1, new TimeOnly(12, 0), new TimeOnly(14, 0)));
        var days = new[] { EmptyDay(Date1) };

        var (scheduled, unscheduled) = PlanScheduler.Assign(
            [actA, actB],
            [forecastA, forecastB],
            [WithPlace(CategoryA, PlaceA), WithPlace(CategoryB, PlaceB)],
            days);

        Assert.Equal(2, scheduled.Count);
        Assert.Empty(unscheduled);

        var a = scheduled.Single(s => s.ActivityName == "Kayaking");
        var b = scheduled.Single(s => s.ActivityName == "Cycling");
        Assert.True(a.EndTime <= b.StartTime || b.EndTime <= a.StartTime, "Slots overlap");
    }

    [Fact]
    public void Assign_ScheduledActivity_CarriesItsCategoryIdAndNoTravelYet()
    {
        // The travel check (feature 009) runs after the scheduler and finds the listed places by CategoryId.
        var actA = Activity("Kayaking", CategoryA);
        var actB = Activity("Museum", CategoryB);
        var forecastA = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var forecastB = Forecast(false, (Date2, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var places = new[] { WithPlace(CategoryA, PlaceA), WithPlace(CategoryB, PlaceB) };

        var (scheduled, _) = PlanScheduler.Assign(
            [actA, actB], [forecastA, forecastB], places, [EmptyDay(Date1), EmptyDay(Date2)]);

        Assert.Equal(CategoryA, scheduled.Single(s => s.ActivityName == "Kayaking").CategoryId);
        Assert.Equal(CategoryB, scheduled.Single(s => s.ActivityName == "Museum").CategoryId);
        Assert.All(scheduled, activity => Assert.Null(activity.Travel));
    }

    [Fact]
    public void Assign_SetsEachEntrysActivityIndex_AlsoForARepeatedCategory()
    {
        // Cycling twice with different limits, and an unscheduled activity between them, so the index is the
        // position in the plan's activities, not in the schedule (feature 012 research section 4).
        var strictCycling = Activity("Cycling", CategoryA) with { MaxWindMs = 5m };
        var noPlaceMuseum = IndoorActivity("Museum", CategoryB);
        var relaxedCycling = Activity("Cycling", CategoryA) with { MaxWindMs = 10m };
        var forecastFirst = Forecast(false, (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var forecastMuseum = Forecast(true, (Date1, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var forecastSecond = Forecast(false, (Date2, new TimeOnly(10, 0), new TimeOnly(14, 0)));
        var places = new[] { WithPlace(CategoryA, PlaceA), NoPlaces(CategoryB) };

        var (scheduled, unscheduled) = PlanScheduler.Assign(
            [strictCycling, noPlaceMuseum, relaxedCycling],
            [forecastFirst, forecastMuseum, forecastSecond],
            places,
            [EmptyDay(Date1), EmptyDay(Date2)]);

        Assert.Single(unscheduled);
        Assert.Equal(0, scheduled.Single(s => s.Date == Date1).ActivityIndex);
        Assert.Equal(2, scheduled.Single(s => s.Date == Date2).ActivityIndex);
    }

    [Fact]
    public void TravelRules_KeepTheActivityIndex()
    {
        var actA = Activity("Kayaking", CategoryA);
        var actB = Activity("Cycling", CategoryB);
        var forecastA = Forecast(false, (Date1, new TimeOnly(8, 0), new TimeOnly(10, 0)));
        var forecastB = Forecast(false, (Date1, new TimeOnly(12, 0), new TimeOnly(16, 0)));
        var places = new[] { WithPlace(CategoryA, PlaceA), WithPlace(CategoryB, PlaceB) };

        var (scheduled, _) = PlanScheduler.Assign(
            [actA, actB], [forecastA, forecastB], places, [EmptyDay(Date1)]);
        var (withTravel, _) = TravelDistanceRules.Apply(scheduled, places, 30);

        Assert.Equal(0, withTravel.Single(s => s.ActivityName == "Kayaking").ActivityIndex);
        Assert.Equal(1, withTravel.Single(s => s.ActivityName == "Cycling").ActivityIndex);
        Assert.NotNull(withTravel.Single(s => s.ActivityName == "Cycling").Travel);
    }
}
