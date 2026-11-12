using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Which places an activity lists and in which order (spec FR-006, FR-007, Edge cases; research sections 3
/// and 4). Elements are placed due north of the origin, where the distance is the latitude difference times
/// the length of one degree, so each test chooses its distances exactly.
/// </summary>
public sealed class NearbyPlaceRulesTests
{
    private const int RadiusKm = 10;
    private const int MaxPlaces = 5;

    // One degree of latitude on the sphere GeoDistance uses.
    private const double KmPerDegree = GeoDistance.EarthRadiusKm * Math.PI / 180;

    private static readonly PlaceLocation Origin = new(593118, "Kaunas", "Kauno m.", 54.0, 23.0);
    private static readonly string[] KayakingTags = ["leisure=slipway", "sport=canoe"];

    [Fact]
    public void PlacesInsideAndOnTheEdge_AreListedAndPlacesOutsideAreNot()
    {
        var places = For(
            Element("node/1", 3.4, ("name", "Inside"), ("leisure", "slipway")),
            Element("node/2", 10.0, ("name", "Exactly on the edge"), ("leisure", "slipway")),
            Element("node/3", 10.04, ("name", "Shown as on the edge"), ("leisure", "slipway")),
            Element("node/4", 10.06, ("name", "Just outside"), ("leisure", "slipway")));

        Assert.Equal(["Inside", "Exactly on the edge", "Shown as on the edge"], places.Select(place => place.Name));
        Assert.Equal([3.4m, 10.0m, 10.0m], places.Select(place => place.DistanceKm));
    }

    [Fact]
    public void ElementWithoutAName_IsNotListed()
    {
        var places = For(Element("node/1", 1, ("leisure", "slipway")));

        Assert.Empty(places);
    }

    [Fact]
    public void LithuanianName_IsPreferredToTheDefaultName()
    {
        var place = Assert.Single(For(
            Element("node/1", 1, ("name", "Kaunas Slipway"), ("name:lt", "Kauno slipas"), ("leisure", "slipway"))));

        Assert.Equal("Kauno slipas", place.Name);
    }

    [Fact]
    public void BlankLithuanianName_FallsBackToTheDefaultNameTrimmed()
    {
        var place = Assert.Single(For(
            Element("node/1", 1, ("name", "  Nemuno slipway "), ("name:lt", "   "), ("leisure", "slipway"))));

        Assert.Equal("Nemuno slipway", place.Name);
    }

    [Fact]
    public void BlankDefaultName_IsNotListed()
    {
        var places = For(Element("node/1", 1, ("name", "  "), ("leisure", "slipway")));

        Assert.Empty(places);
    }

    [Fact]
    public void ElementMatchingTwoTags_IsListedOnce()
    {
        var place = Assert.Single(For(
            Element("node/1", 1, ("name", "Both"), ("leisure", "slipway"), ("sport", "canoe"))));

        Assert.Equal("Both", place.Name);
    }

    [Fact]
    public void SameElementTwice_IsListedOnce()
    {
        var places = For(
            Element("way/7", 1, ("name", "Twice"), ("leisure", "slipway")),
            Element("way/7", 1, ("name", "Twice"), ("leisure", "slipway")));

        Assert.Single(places);
    }

    [Fact]
    public void OnlyExactTagsMatch()
    {
        var places = For(
            Element("node/1", 1, ("name", "Other tag"), ("tourism", "museum")),
            Element("node/2", 1, ("name", "Longer value"), ("leisure", "slipway_extra")),
            Element("node/3", 1, ("name", "Longer key"), ("leisurex", "slipway")),
            Element("node/4", 1, ("name", "Other case"), ("leisure", "Slipway")));

        Assert.Empty(places);
    }

    [Fact]
    public void MoreThanTheMaximum_KeepsTheNearest()
    {
        var places = For(
            Element("node/1", 7, ("name", "G"), ("leisure", "slipway")),
            Element("node/2", 1, ("name", "A"), ("leisure", "slipway")),
            Element("node/3", 6, ("name", "F"), ("leisure", "slipway")),
            Element("node/4", 2, ("name", "B"), ("leisure", "slipway")),
            Element("node/5", 5, ("name", "E"), ("leisure", "slipway")),
            Element("node/6", 3, ("name", "C"), ("leisure", "slipway")),
            Element("node/7", 4, ("name", "D"), ("leisure", "slipway")));

        Assert.Equal(["A", "B", "C", "D", "E"], places.Select(place => place.Name));
    }

    [Fact]
    public void PlacesAtTheSameShownDistance_AreOrderedByNameInLithuanianOrder()
    {
        // 2.01 and 1.98 km are both shown as 2.0 km.
        var places = For(
            Element("node/1", 2.01, ("name", "Dainava"), ("leisure", "slipway")),
            Element("node/2", 1.98, ("name", "Čiurlionis"), ("leisure", "slipway")),
            Element("node/3", 2.0, ("name", "Cukrus"), ("leisure", "slipway")));

        Assert.Equal(["Cukrus", "Čiurlionis", "Dainava"], places.Select(place => place.Name));
    }

    [Fact]
    public void SameNameAndDistance_AreOrderedByKey()
    {
        var places = For(
            Element("way/1", 2, ("name", "Twin"), ("leisure", "slipway"), ("addr:city", "Way")),
            Element("node/1", 2, ("name", "Twin"), ("leisure", "slipway"), ("addr:city", "Node")));

        Assert.Equal(["Node", "Way"], places.Select(place => place.Area));
    }

    [Fact]
    public void SameNameAtDifferentPositions_AreBothListed()
    {
        var places = For(
            Element("node/1", 1, ("name", "Prieplauka"), ("leisure", "slipway")),
            Element("node/2", 4, ("name", "Prieplauka"), ("leisure", "slipway")));

        Assert.Equal([1.0m, 4.0m], places.Select(place => place.DistanceKm));
    }

    [Theory]
    [InlineData(" Kaunas ", "Kaunas")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void Area_IsTheTrimmedCityOrNone(string? city, string? expected)
    {
        var tags = city is null
            ? new[] { ("name", "Place"), ("leisure", "slipway") }
            : new[] { ("name", "Place"), ("leisure", "slipway"), ("addr:city", city) };

        var place = Assert.Single(For(Element("node/1", 1, tags)));

        Assert.Equal(expected, place.Area);
    }

    [Theory]
    [InlineData(3.44, 3.4)]
    [InlineData(3.46, 3.5)]
    [InlineData(0.02, 0.0)]
    public void Distance_IsRoundedToOneDecimalPlace(double kilometres, double shown)
    {
        var place = Assert.Single(For(Element("node/1", kilometres, ("name", "Place"), ("leisure", "slipway"))));

        Assert.Equal((decimal)shown, place.DistanceKm);
    }

    [Fact]
    public void Position_IsRoundedToFiveDecimalPlaces()
    {
        var element = new MapElement(
            "node/1",
            54.0123456789,
            23.0000049,
            new Dictionary<string, string> { ["name"] = "Place", ["leisure"] = "slipway" });

        var place = Assert.Single(For(element));

        Assert.Equal(54.01235, place.Latitude);
        Assert.Equal(23.0, place.Longitude);
        Assert.Equal("node/1", place.Key);
    }

    private static IReadOnlyList<NearbyPlace> For(params MapElement[] elements) =>
        NearbyPlaceRules.For(elements, KayakingTags, Origin, RadiusKm, MaxPlaces);

    private static MapElement Element(string key, double kmNorth, params (string Key, string Value)[] tags) =>
        new(
            key,
            Origin.Latitude + kmNorth / KmPerDegree,
            Origin.Longitude,
            tags.ToDictionary(tag => tag.Key, tag => tag.Value));
}
