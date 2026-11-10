using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Joining suitable hours into periods and marking the ones an activity does not fit into (spec FR-021).</summary>
public sealed class SuitablePeriodsTests
{
    [Fact]
    public void ConsecutiveSuitableHours_FormOnePeriodPerRun()
    {
        // Suitable 10:00–14:00, unsuitable 14:00–16:00, suitable 16:00–17:00.
        var hours = Hours(8, "..xxxx..x..");

        var periods = SuitablePeriods.From(hours, 1m);

        Assert.Equal(
            [
                new SuitablePeriod(new TimeOnly(10, 0), new TimeOnly(14, 0), 4, false),
                new SuitablePeriod(new TimeOnly(16, 0), new TimeOnly(17, 0), 1, false)
            ],
            periods);
    }

    [Theory]
    [InlineData("")]
    [InlineData("....")]
    public void NoSuitableHour_GivesNoPeriod(string pattern)
    {
        Assert.Empty(SuitablePeriods.From(Hours(6, pattern), 2m));
    }

    [Fact]
    public void RunAtTheEndOfTheDay_IsClosed()
    {
        var period = Assert.Single(SuitablePeriods.From(Hours(19, ".xx"), 1m));

        Assert.Equal(new TimeOnly(20, 0), period.Start);
        Assert.Equal(new TimeOnly(22, 0), period.End);
    }

    [Fact]
    public void HoursWithAGapInTime_AreNotJoined()
    {
        // Today's started hours are left out, but a gap inside the list must still split a run.
        HourSuitability[] hours = [Suitable(10), Suitable(12)];

        Assert.Equal(2, SuitablePeriods.From(hours, 1m).Count);
    }

    [Theory]
    [InlineData(2.0, "x", true)]
    [InlineData(2.0, "xx", false)]
    [InlineData(2.0, "xxx", false)]
    [InlineData(1.5, "x", true)]
    [InlineData(1.5, "xx", false)]
    [InlineData(0.5, "x", false)]
    public void PeriodShorterThanTheDuration_IsMarked(double durationHours, string pattern, bool shorter)
    {
        var period = Assert.Single(SuitablePeriods.From(Hours(10, pattern), (decimal)durationHours));

        Assert.Equal(shorter, period.ShorterThanDuration);
    }

    /// <summary>One hour per character from <paramref name="firstHour"/>: "x" suitable, "." unsuitable.</summary>
    internal static HourSuitability[] Hours(int firstHour, string pattern) =>
        pattern
            .Select((mark, index) => mark == 'x' ? Suitable(firstHour + index) : Unsuitable(firstHour + index))
            .ToArray();

    private static HourSuitability Suitable(int hour) => new(new TimeOnly(hour, 0), []);

    private static HourSuitability Unsuitable(int hour) => new(new TimeOnly(hour, 0), ["Too windy: 9.0 m/s, maximum 8.0 m/s"]);
}
