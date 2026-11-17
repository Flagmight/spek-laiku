using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Travel distance between consecutive activities (feature 009 spec FR-001 to FR-003, SC-001, SC-003, research
/// sections 2 to 5). Scheduled activities are built directly, because the time slots come from the scheduler.
/// </summary>
public sealed class TravelDistanceRulesTests
{
    private const int MaxKm = 30;

    private static readonly DateOnly Date1 = new(2026, 11, 14);
    private static readonly DateOnly Date2 = new(2026, 11, 15);

    private static readonly Guid CategoryA = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid CategoryB = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid CategoryC = Guid.Parse("cccccccc-0000-0000-0000-000000000001");

    // Kaunas: about 1.4 km between A and B, about 3.3 km between B and C.
    private static readonly NearbyPlace PlaceA = new("Place A", 54.8972, 23.8861, 1.0m, "Kaunas", "node/1");
    private static readonly NearbyPlace PlaceB = new("Place B", 54.8991, 23.9081, 1.2m, "Kaunas", "node/2");
    private static readonly NearbyPlace PlaceC = new("Place C", 54.9271, 23.9201, 3.5m, "Kaunas", "node/3");

    private static readonly WeatherSnapshot Weather = new(12m, 0m, 3m, IsIndoor: false);

    private static ScheduledActivity Activity(
        string name, Guid categoryId, NearbyPlace place, DateOnly date, int startHour, int endHour) =>
        new(categoryId, name, date, new TimeOnly(startHour, 0), new TimeOnly(endHour, 0), place, Weather);

    // One listed place per category, so the place choice (user story 2) is not involved.
    private static readonly IReadOnlyList<CategoryPlaces> OnePlaceEach =
    [
        new(CategoryA, [PlaceA]),
        new(CategoryB, [PlaceB]),
        new(CategoryC, [PlaceC])
    ];

    private static decimal Expected(NearbyPlace from, NearbyPlace to) =>
        GeoDistance.RoundToTenth(GeoDistance.Kilometres(from.Latitude, from.Longitude, to.Latitude, to.Longitude));

    [Fact]
    public void FirstActivityOfADate_HasNoTrip()
    {
        var (scheduled, _) = TravelDistanceRules.Apply(
            [Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11)], OnePlaceEach, MaxKm);

        Assert.Null(Assert.Single(scheduled).Travel);
    }

    [Fact]
    public void SecondActivity_TripIsFromThePreviousPlace_RoundedStraightLineDistance()
    {
        var (scheduled, _) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
                Activity("Picnic", CategoryB, PlaceB, Date1, 12, 16)
            ],
            OnePlaceEach,
            MaxKm);

        var travel = scheduled[1].Travel;
        Assert.NotNull(travel);
        Assert.Equal("Place A", travel.FromPlaceName);
        Assert.Equal(Expected(PlaceA, PlaceB), travel.DistanceKm);
        Assert.InRange(travel.DistanceKm, 1.0m, 2.0m);
        Assert.False(travel.OverLimit);
    }

    [Fact]
    public void Activities_AreTakenInStartTimeOrder_NotListOrder()
    {
        // The scheduler returns plan order; here the later activity comes first in the list.
        var (scheduled, _) = TravelDistanceRules.Apply(
            [
                Activity("Cycling", CategoryC, PlaceC, Date1, 17, 19),
                Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
                Activity("Picnic", CategoryB, PlaceB, Date1, 12, 16)
            ],
            OnePlaceEach,
            MaxKm);

        Assert.Equal(["Kayaking", "Picnic", "Cycling"], scheduled.Select(s => s.ActivityName));
        Assert.Null(scheduled[0].Travel);
        Assert.Equal("Place A", scheduled[1].Travel!.FromPlaceName);
        Assert.Equal("Place B", scheduled[2].Travel!.FromPlaceName);
        Assert.Equal(Expected(PlaceB, PlaceC), scheduled[2].Travel!.DistanceKm);
    }

    [Fact]
    public void DifferentDates_AreNeverConsecutive()
    {
        var (scheduled, _) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
                Activity("Picnic", CategoryB, PlaceB, Date2, 8, 11)
            ],
            OnePlaceEach,
            MaxKm);

        Assert.All(scheduled, activity => Assert.Null(activity.Travel));
    }

    [Fact]
    public void SamePlaceTwice_IsAZeroTripNeverOverTheLimit()
    {
        var (scheduled, summary) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
                Activity("Rowing", CategoryA, PlaceA, Date1, 12, 16)
            ],
            OnePlaceEach,
            maxDistanceKm: 1);

        Assert.Equal(0.0m, scheduled[1].Travel!.DistanceKm);
        Assert.False(scheduled[1].Travel!.OverLimit);
        Assert.Equal(0, summary.TripsOverLimit);
    }

    [Fact]
    public void Result_IsInChronologicalOrder()
    {
        var (scheduled, _) = TravelDistanceRules.Apply(
            [
                Activity("Late on day 2", CategoryC, PlaceC, Date2, 14, 16),
                Activity("Late on day 1", CategoryB, PlaceB, Date1, 14, 16),
                Activity("Early on day 2", CategoryA, PlaceA, Date2, 8, 11),
                Activity("Early on day 1", CategoryA, PlaceA, Date1, 8, 11)
            ],
            OnePlaceEach,
            MaxKm);

        Assert.Equal(
            ["Early on day 1", "Late on day 1", "Early on day 2", "Late on day 2"],
            scheduled.Select(s => s.ActivityName));
    }

    [Fact]
    public void TimesDatesAndWeather_AreNeverChanged()
    {
        var input = new[]
        {
            Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
            Activity("Picnic", CategoryB, PlaceB, Date1, 12, 16),
            Activity("Cycling", CategoryC, PlaceC, Date2, 9, 13)
        };

        var (scheduled, _) = TravelDistanceRules.Apply(input, OnePlaceEach, maxDistanceKm: 1);

        foreach (var original in input)
        {
            var result = scheduled.Single(s => s.ActivityName == original.ActivityName);
            Assert.Equal(original.Date, result.Date);
            Assert.Equal(original.StartTime, result.StartTime);
            Assert.Equal(original.EndTime, result.EndTime);
            Assert.Equal(original.Weather, result.Weather);
            Assert.Equal(original.CategoryId, result.CategoryId);
        }
    }

    [Fact]
    public void Summary_CarriesTheMaximumUsed()
    {
        var (_, summary) = TravelDistanceRules.Apply(
            [Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11)], OnePlaceEach, maxDistanceKm: 45);

        Assert.Equal(45, summary.MaxDistanceKm);
    }

    [Fact]
    public void Summary_CountsTheTripsOverTheLimit()
    {
        // A→B is about 1.4 km and B→C about 3.3 km: both are over a 1 km limit.
        var (scheduled, summary) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, PlaceA, Date1, 8, 11),
                Activity("Picnic", CategoryB, PlaceB, Date1, 12, 14),
                Activity("Cycling", CategoryC, PlaceC, Date1, 15, 17)
            ],
            OnePlaceEach,
            maxDistanceKm: 1);

        Assert.True(scheduled[1].Travel!.OverLimit);
        Assert.True(scheduled[2].Travel!.OverLimit);
        Assert.Equal(2, summary.TripsOverLimit);
    }

    [Fact]
    public void EmptySchedule_GivesNoActivitiesAndNoTripsOverTheLimit()
    {
        var (scheduled, summary) = TravelDistanceRules.Apply([], OnePlaceEach, MaxKm);

        Assert.Empty(scheduled);
        Assert.Equal(new TravelSummary(MaxKm, 0), summary);
    }

    // --- place choice (user story 2, spec FR-004, FR-005, SC-002) ---

    /// <summary>A place this many km north of <see cref="Start"/> along a meridian, so distances are exact.</summary>
    private static NearbyPlace North(string name, double km) =>
        new(name, 54.9 + km / (GeoDistance.EarthRadiusKm * Math.PI / 180), 23.9, 1.0m, null, $"node/{name}");

    private static readonly NearbyPlace Start = North("Start", 0);

    /// <summary>The first activity (category A, at <see cref="Start"/>) and a second one in category B.</summary>
    private static (IReadOnlyList<ScheduledActivity> Scheduled, TravelSummary Summary) ApplyWithSecondIn(
        IReadOnlyList<NearbyPlace> categoryBPlaces, int maxDistanceKm) =>
        TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, Start, Date1, 8, 11),
                // The scheduler always gives the nearest place (feature 008); the travel check may change it.
                Activity("Picnic", CategoryB, categoryBPlaces[0], Date1, 12, 16)
            ],
            [new(CategoryA, [Start]), new(CategoryB, categoryBPlaces)],
            maxDistanceKm);

    [Fact]
    public void NearestPlaceWithinTheMaximum_IsKept()
    {
        var (scheduled, _) = ApplyWithSecondIn([North("B1", 2), North("B2", 1)], maxDistanceKm: 10);

        Assert.Equal("B1", scheduled[1].Place.Name);
        Assert.Equal(2.0m, scheduled[1].Travel!.DistanceKm);
        Assert.False(scheduled[1].Travel!.OverLimit);
    }

    [Fact]
    public void NearestPlaceTooFar_TheFirstListedPlaceWithinTheMaximumIsUsed()
    {
        var (scheduled, summary) = ApplyWithSecondIn(
            [North("B1", 18), North("B2", 15), North("B3", 6)], maxDistanceKm: 10);

        Assert.Equal("B3", scheduled[1].Place.Name);
        Assert.Equal(new TravelLeg("Start", 6.0m, OverLimit: false), scheduled[1].Travel);
        Assert.Equal(0, summary.TripsOverLimit);
    }

    [Fact]
    public void SeveralPlacesWithinTheMaximum_TheFirstInListOrderIsUsed()
    {
        // B3 is closer to the previous place, but B2 comes first in the list (nearest to the plan location).
        var (scheduled, _) = ApplyWithSecondIn(
            [North("B1", 18), North("B2", 5), North("B3", 3)], maxDistanceKm: 10);

        Assert.Equal("B2", scheduled[1].Place.Name);
        Assert.Equal(5.0m, scheduled[1].Travel!.DistanceKm);
    }

    [Fact]
    public void NoListedPlaceWithinTheMaximum_NearestPlaceIsKeptAndTheTripIsFlagged()
    {
        var (scheduled, summary) = ApplyWithSecondIn([North("B1", 18), North("B2", 15)], maxDistanceKm: 10);

        Assert.Equal("B1", scheduled[1].Place.Name);
        Assert.Equal(new TravelLeg("Start", 18.0m, OverLimit: true), scheduled[1].Travel);
        Assert.Equal(1, summary.TripsOverLimit);
    }

    [Fact]
    public void ChosenAlternativePlace_IsThePreviousPlaceForTheNextActivity()
    {
        var b3 = North("B3", 6);
        var c1 = North("C1", 7);

        var (scheduled, _) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, Start, Date1, 8, 10),
                Activity("Picnic", CategoryB, North("B1", 18), Date1, 11, 13),
                Activity("Cycling", CategoryC, c1, Date1, 14, 16)
            ],
            [new(CategoryA, [Start]), new(CategoryB, [North("B1", 18), b3]), new(CategoryC, [c1])],
            maxDistanceKm: 10);

        Assert.Equal("B3", scheduled[1].Place.Name);
        Assert.Equal(new TravelLeg("B3", 1.0m, OverLimit: false), scheduled[2].Travel);
    }

    [Fact]
    public void FirstActivityOfADate_UsesItsNearestPlace()
    {
        var nearest = North("A1", 1);

        var (scheduled, _) = TravelDistanceRules.Apply(
            [Activity("Kayaking", CategoryA, North("A2", 2), Date1, 8, 11)],
            [new(CategoryA, [nearest, North("A2", 2)])],
            maxDistanceKm: 10);

        Assert.Equal("A1", scheduled[0].Place.Name);
        Assert.Null(scheduled[0].Travel);
    }

    public static TheoryData<double[], int> CandidateSets => new()
    {
        { new[] { 18.0, 15.0, 6.0 }, 10 },
        { new[] { 12.0, 9.9, 30.0 }, 10 },
        { new[] { 3.0 }, 3 },
        { new[] { 50.0, 40.0, 30.0, 20.0, 1.0 }, 5 },
        { new[] { 2.1, 2.2 }, 2 }
    };

    [Theory]
    [MemberData(nameof(CandidateSets))]
    public void WheneverAListedPlaceFits_TheTripIsNotOverTheLimit_AndThePlaceIsAListedOne(
        double[] kmFromPrevious, int maxDistanceKm)
    {
        var places = kmFromPrevious.Select((km, index) => North($"B{index + 1}", km)).ToList();

        var (scheduled, _) = ApplyWithSecondIn(places, maxDistanceKm);

        var second = scheduled[1];
        Assert.Contains(second.Place, places);
        Assert.Equal(kmFromPrevious.Any(km => km <= maxDistanceKm), !second.Travel!.OverLimit);
    }

    // --- the limit (user story 3, spec FR-002, SC-001) ---

    [Theory]
    [InlineData(30.0, "30.0", false)]
    [InlineData(30.1, "30.1", true)]
    [InlineData(30.04, "30.0", false)] // shown as 30.0 km, so not flagged (research section 3)
    [InlineData(29.96, "30.0", false)]
    [InlineData(30.2, "30.2", true)]
    public void TripAtTheLimit_ComparesTheShownValue_AndIsFlaggedOnlyWhenGreater(
        double km, string shown, bool overLimit)
    {
        var (scheduled, summary) = ApplyWithSecondIn([North("B1", km)], maxDistanceKm: 30);

        var travel = scheduled[1].Travel!;
        Assert.Equal(decimal.Parse(shown, System.Globalization.CultureInfo.InvariantCulture), travel.DistanceKm);
        Assert.Equal(overLimit, travel.OverLimit);
        Assert.Equal(overLimit ? 1 : 0, summary.TripsOverLimit);
    }

    [Fact]
    public void TripsOverLimit_CountsExactlyTheFlaggedTripsAcrossDates()
    {
        // Day 1: 4 km (fine), then 12 km (over). Day 2: 15 km (over). Limit 10 km.
        var (scheduled, summary) = TravelDistanceRules.Apply(
            [
                Activity("Kayaking", CategoryA, Start, Date1, 8, 10),
                Activity("Picnic", CategoryB, North("B1", 4), Date1, 11, 13),
                Activity("Cycling", CategoryC, North("C1", 16), Date1, 14, 16),
                Activity("Rowing", CategoryA, Start, Date2, 8, 10),
                Activity("Climbing", CategoryC, North("C1", 16), Date2, 11, 13)
            ],
            [new(CategoryA, [Start]), new(CategoryB, [North("B1", 4)]), new(CategoryC, [North("C1", 16)])],
            maxDistanceKm: 10);

        Assert.Equal([false, true, true], scheduled.Where(s => s.Travel is not null).Select(s => s.Travel!.OverLimit));
        Assert.Equal(2, summary.TripsOverLimit);
    }
}
