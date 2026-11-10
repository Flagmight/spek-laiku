using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Every rule and reason of <see cref="HourSuitabilityRules"/> (spec FR-013 to FR-019, SC-003, SC-004;
/// data-model.md HourSuitabilityRules), with each limit exactly at, 0.1 inside and 0.1 outside.
/// </summary>
public sealed class HourSuitabilityRulesTests
{
    // 15 to 35 °C, rain up to 0.5 mm/h, wind up to 8 m/s, daylight required.
    private static readonly CheckedPlanActivity Kayaking = new(
        Guid.NewGuid(), "Kayaking", ActivityType.Outdoor, 2m, true, 8m, 0.5m, 15m, 35m);

    private static readonly CheckedPlanActivity Museum = new(
        Guid.NewGuid(), "Museum", ActivityType.Indoor, 1.5m, false, null, null, null, null);

    [Fact]
    public void HourWithinEveryLimitInDaylight_IsSuitable()
    {
        Assert.Empty(HourSuitabilityRules.Check(Hour(20m, 0m, 3m), Kayaking));
    }

    [Theory]
    // Temperature: at, inside and outside each limit.
    [InlineData(15.0, 0.0, 3.0, null)]
    [InlineData(15.1, 0.0, 3.0, null)]
    [InlineData(14.9, 0.0, 3.0, "Too cold: 14.9 °C, minimum 15.0 °C")]
    [InlineData(35.0, 0.0, 3.0, null)]
    [InlineData(34.9, 0.0, 3.0, null)]
    [InlineData(35.1, 0.0, 3.0, "Too warm: 35.1 °C, maximum 35.0 °C")]
    // Rain.
    [InlineData(20.0, 0.5, 3.0, null)]
    [InlineData(20.0, 0.4, 3.0, null)]
    [InlineData(20.0, 0.6, 3.0, "Too much rain: 0.6 mm/h, maximum 0.5 mm/h")]
    // Wind.
    [InlineData(20.0, 0.0, 8.0, null)]
    [InlineData(20.0, 0.0, 7.9, null)]
    [InlineData(20.0, 0.0, 8.1, "Too windy: 8.1 m/s, maximum 8.0 m/s")]
    public void EachWeatherLimit_IncludesItsValueAndRefusesBeyondIt(
        double temperature,
        double rain,
        double wind,
        string? reason)
    {
        var reasons = HourSuitabilityRules.Check(Hour((decimal)temperature, (decimal)rain, (decimal)wind), Kayaking);

        if (reason is null)
        {
            Assert.Empty(reasons);
        }
        else
        {
            Assert.Equal([reason], reasons);
        }
    }

    [Theory]
    [InlineData(0.0, true)]
    [InlineData(0.1, false)]
    public void RainLimitOfZero_AcceptsOnlyNoRain(double rain, bool suitable)
    {
        var dryOnly = Kayaking with { MaxRainMmPerHour = 0m };

        var reasons = HourSuitabilityRules.Check(Hour(20m, (decimal)rain, 3m), dryOnly);

        Assert.Equal(suitable, reasons.Count == 0);
    }

    [Fact]
    public void SeveralFailures_AreAllListedInTheSpecOrder()
    {
        var reasons = HourSuitabilityRules.Check(Hour(4.2m, 1.2m, 9m, daylight: false), Kayaking);

        Assert.Equal(
            [
                "Too cold: 4.2 °C, minimum 15.0 °C",
                "Too much rain: 1.2 mm/h, maximum 0.5 mm/h",
                "Too windy: 9.0 m/s, maximum 8.0 m/s",
                HourSuitabilityRules.OutsideDaylight
            ],
            reasons);
    }

    [Fact]
    public void TooWarmComesBeforeRainAndWind()
    {
        var reasons = HourSuitabilityRules.Check(Hour(36m, 0.6m, 8.1m), Kayaking);

        Assert.Equal("Too warm: 36.0 °C, maximum 35.0 °C", reasons[0]);
        Assert.Equal(3, reasons.Count);
    }

    [Fact]
    public void HourOutsideDaylight_IsUnsuitableOnlyWhenTheActivityRequiresDaylight()
    {
        var dark = Hour(20m, 0m, 3m, daylight: false);

        Assert.Equal([HourSuitabilityRules.OutsideDaylight], HourSuitabilityRules.Check(dark, Kayaking));
        Assert.Empty(HourSuitabilityRules.Check(dark, Kayaking with { RequiresDaylight = false }));
    }

    [Theory]
    [InlineData(true, false, false)]
    [InlineData(false, true, false)]
    [InlineData(false, false, true)]
    public void MissingValue_GivesOnlyNoForecastInsteadOfTheWeatherChecks(bool noTemperature, bool noRain, bool noWind)
    {
        // The other values are far outside the limits, but cannot be judged without the missing one.
        var hour = new PlanningHour(
            new TimeOnly(12, 0),
            new TimeOnly(13, 0),
            noTemperature ? null : -10m,
            noRain ? null : 5m,
            noWind ? null : 20m,
            true);

        Assert.Equal([HourSuitabilityRules.NoForecast], HourSuitabilityRules.Check(hour, Kayaking));
    }

    [Fact]
    public void MissingValueOutsideDaylight_ListsDaylightFirst()
    {
        var hour = new PlanningHour(new TimeOnly(21, 0), new TimeOnly(22, 0), null, null, null, false);

        Assert.Equal(
            [HourSuitabilityRules.OutsideDaylight, HourSuitabilityRules.NoForecast],
            HourSuitabilityRules.Check(hour, Kayaking));
    }

    [Fact]
    public void IndoorWithoutDaylight_IsSuitableWhateverTheWeatherOrData()
    {
        var storm = Hour(-25m, 15m, 25m, daylight: false);
        var noData = new PlanningHour(new TimeOnly(21, 0), new TimeOnly(22, 0), null, null, null, false);

        Assert.Empty(HourSuitabilityRules.Check(storm, Museum));
        Assert.Empty(HourSuitabilityRules.Check(noData, Museum));
    }

    [Fact]
    public void IndoorWithDaylight_IsJudgedOnlyOnDaylight()
    {
        var museumByDay = Museum with { RequiresDaylight = true };
        var noData = new PlanningHour(new TimeOnly(21, 0), new TimeOnly(22, 0), null, null, null, false);

        Assert.Equal([HourSuitabilityRules.OutsideDaylight], HourSuitabilityRules.Check(noData, museumByDay));
        Assert.Empty(HourSuitabilityRules.Check(Hour(-25m, 15m, 25m), museumByDay));
    }

    [Fact]
    public void NegativeTemperatures_AreWrittenWithOneDecimalPlace()
    {
        var reasons = HourSuitabilityRules.Check(Hour(-3m, 0m, 3m), Kayaking with { MinTemperatureC = -1m });

        Assert.Equal(["Too cold: -3.0 °C, minimum -1.0 °C"], reasons);
    }

    private static PlanningHour Hour(decimal temperature, decimal rain, decimal wind, bool daylight = true) =>
        new(new TimeOnly(12, 0), new TimeOnly(13, 0), temperature, rain, wind, daylight);
}
