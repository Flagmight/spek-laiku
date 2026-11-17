using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The straight-line distance used for every place (research section 3).</summary>
public sealed class GeoDistanceTests
{
    [Fact]
    public void SamePoint_IsZero()
    {
        Assert.Equal(0, GeoDistance.Kilometres(54.8972, 23.8861, 54.8972, 23.8861));
    }

    [Fact]
    public void OneHundredthOfADegreeAlongAMeridian_IsAbout1112Metres()
    {
        var distance = GeoDistance.Kilometres(54.0, 23.0, 54.01, 23.0);

        Assert.Equal(1.112, distance, 0.001);
    }

    [Fact]
    public void VilniusToKaunas_MatchesTheSphericalLawOfCosines()
    {
        // 92.3414 km, computed independently with the spherical law of cosines and the same Earth radius.
        var distance = GeoDistance.Kilometres(54.6872, 25.2797, 54.8972, 23.8861);

        Assert.Equal(92.3414, distance, 0.01);
    }

    [Fact]
    public void Distance_IsTheSameInBothDirections()
    {
        var there = GeoDistance.Kilometres(54.6872, 25.2797, 55.7033, 21.1443);
        var back = GeoDistance.Kilometres(55.7033, 21.1443, 54.6872, 25.2797);

        Assert.Equal(there, back, 1e-9);
    }

    [Theory]
    [InlineData(30.04, "30.0")]
    [InlineData(30.05, "30.1")]
    [InlineData(0.0, "0.0")]
    [InlineData(4.249, "4.2")]
    public void RoundToTenth_RoundsHalfAwayFromZeroToOneDecimal(double km, string expected)
    {
        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture), GeoDistance.RoundToTenth(km));
    }
}
