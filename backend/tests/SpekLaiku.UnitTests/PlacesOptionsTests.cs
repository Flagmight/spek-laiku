using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The <c>Places</c> settings that the API checks at start (research section 6).</summary>
public sealed class PlacesOptionsTests
{
    [Fact]
    public void Defaults_AreValidWithA50KmCapFivePlacesAnd24Hours()
    {
        var options = new PlacesOptions();

        Assert.True(PlacesOptions.IsValid(options));
        Assert.Equal(50, options.MaxRadiusKm);
        Assert.Equal(5, options.MaxPlacesPerActivity);
        Assert.Equal(24, options.MaxAgeHours);
    }

    [Theory]
    [InlineData(1, 1, 1)]
    [InlineData(200, 20, 1)]
    [InlineData(1, 20, 1000)]
    public void SettingsAtTheLimits_AreAccepted(int maxRadiusKm, int maxPlaces, int maxAgeHours)
    {
        var options = new PlacesOptions
        {
            MaxRadiusKm = maxRadiusKm,
            MaxPlacesPerActivity = maxPlaces,
            MaxAgeHours = maxAgeHours
        };

        Assert.True(PlacesOptions.IsValid(options));
    }

    [Theory]
    [InlineData(0, 5, 24)]
    [InlineData(201, 5, 24)]
    [InlineData(50, 0, 24)]
    [InlineData(50, 21, 24)]
    [InlineData(50, 5, 0)]
    [InlineData(50, 5, -1)]
    public void InvalidSettings_AreRefused(int maxRadiusKm, int maxPlaces, int maxAgeHours)
    {
        var options = new PlacesOptions
        {
            MaxRadiusKm = maxRadiusKm,
            MaxPlacesPerActivity = maxPlaces,
            MaxAgeHours = maxAgeHours
        };

        Assert.False(PlacesOptions.IsValid(options));
    }
}
