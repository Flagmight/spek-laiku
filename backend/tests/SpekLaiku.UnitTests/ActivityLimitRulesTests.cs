using System.Globalization;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The duration and weather limit ranges (spec FR-005, FR-006). Decimals are passed as text.</summary>
public class ActivityLimitRulesTests
{
    private const string DurationMessage = "Enter a duration between 0.5 and 12 hours.";
    private const string WindMessage = "Enter a wind limit between 0 and 30 m/s.";
    private const string RainMessage = "Enter a rain limit between 0 and 20 mm/h.";
    private const string MinTemperatureMessage = "Enter a minimum temperature between -30 and 45 °C.";
    private const string MaxTemperatureMessage = "Enter a maximum temperature between -30 and 45 °C.";
    private const string OrderMessage = "Minimum temperature must be lower than maximum temperature.";

    [Theory]
    [InlineData("0.5")]
    [InlineData("12")]
    [InlineData("1.5")]
    [InlineData("2.0")]
    public void CheckDuration_AcceptsValue(string value)
    {
        Assert.Null(ActivityLimitRules.CheckDuration(Parse(value)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("0.4")]
    [InlineData("12.5")]
    [InlineData("0")]
    [InlineData("1.3")]
    [InlineData("1.25")]
    public void CheckDuration_RefusesValue(string? value)
    {
        Assert.Equal(DurationMessage, ActivityLimitRules.CheckDuration(Parse(value)));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("30")]
    [InlineData("1.50")]
    [InlineData("8.5")]
    public void CheckMaxWind_AcceptsValue(string value)
    {
        Assert.Null(ActivityLimitRules.CheckMaxWind(Parse(value)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("-0.1")]
    [InlineData("30.1")]
    [InlineData("1.25")]
    public void CheckMaxWind_RefusesValue(string? value)
    {
        Assert.Equal(WindMessage, ActivityLimitRules.CheckMaxWind(Parse(value)));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("20")]
    [InlineData("1.50")]
    public void CheckMaxRain_AcceptsValue(string value)
    {
        Assert.Null(ActivityLimitRules.CheckMaxRain(Parse(value)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("-0.1")]
    [InlineData("20.1")]
    [InlineData("1.25")]
    public void CheckMaxRain_RefusesValue(string? value)
    {
        Assert.Equal(RainMessage, ActivityLimitRules.CheckMaxRain(Parse(value)));
    }

    [Theory]
    [InlineData("-30")]
    [InlineData("45")]
    [InlineData("1.50")]
    [InlineData("-5.5")]
    public void CheckTemperatures_AcceptValue(string value)
    {
        Assert.Null(ActivityLimitRules.CheckMinTemperature(Parse(value)));
        Assert.Null(ActivityLimitRules.CheckMaxTemperature(Parse(value)));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("-30.1")]
    [InlineData("45.1")]
    [InlineData("1.25")]
    public void CheckTemperatures_RefuseValue(string? value)
    {
        Assert.Equal(MinTemperatureMessage, ActivityLimitRules.CheckMinTemperature(Parse(value)));
        Assert.Equal(MaxTemperatureMessage, ActivityLimitRules.CheckMaxTemperature(Parse(value)));
    }

    [Fact]
    public void CheckTemperatureOrder_AcceptsLowerMinimum()
    {
        Assert.Null(ActivityLimitRules.CheckTemperatureOrder(14.9m, 15m));
    }

    [Theory]
    [InlineData("15", "15")]
    [InlineData("15.1", "15")]
    public void CheckTemperatureOrder_RefusesEqualOrHigherMinimum(string min, string max)
    {
        Assert.Equal(OrderMessage, ActivityLimitRules.CheckTemperatureOrder(Parse(min)!.Value, Parse(max)!.Value));
    }

    private static decimal? Parse(string? value) =>
        value is null ? null : decimal.Parse(value, CultureInfo.InvariantCulture);
}
