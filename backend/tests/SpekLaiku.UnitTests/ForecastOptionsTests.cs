using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The <c>Forecast</c> settings that the API checks at start (research section 9).</summary>
public sealed class ForecastOptionsTests
{
    [Fact]
    public void Defaults_AreValidAndPlanFrom6To22WithA30MinuteMaximumAge()
    {
        var options = new ForecastOptions();

        Assert.True(ForecastOptions.IsValid(options));
        Assert.Equal(30, options.MaxAgeMinutes);
        Assert.Equal(6, options.FirstHour);
        Assert.Equal(22, options.LastHour);
    }

    [Theory]
    [InlineData(0, 6, 22)]
    [InlineData(-5, 6, 22)]
    [InlineData(30, 22, 22)]
    [InlineData(30, 10, 8)]
    [InlineData(30, -1, 22)]
    [InlineData(30, 6, 24)]
    public void InvalidSettings_AreRefused(int maxAgeMinutes, int firstHour, int lastHour)
    {
        var options = new ForecastOptions { MaxAgeMinutes = maxAgeMinutes, FirstHour = firstHour, LastHour = lastHour };

        Assert.False(ForecastOptions.IsValid(options));
    }

    [Theory]
    [InlineData(1, 0, 23)]
    [InlineData(60, 8, 9)]
    public void SettingsAtTheLimits_AreAccepted(int maxAgeMinutes, int firstHour, int lastHour)
    {
        var options = new ForecastOptions { MaxAgeMinutes = maxAgeMinutes, FirstHour = firstHour, LastHour = lastHour };

        Assert.True(ForecastOptions.IsValid(options));
    }
}
