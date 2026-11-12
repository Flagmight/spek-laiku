using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Today in Lithuania and the next 6 days, at the moments where the Lithuanian date changes (spec FR-010).</summary>
public sealed class ForecastPeriodTests
{
    [Theory]
    // Winter, UTC+2: midnight in Vilnius is 22:00 UTC.
    [InlineData("2026-11-04T21:59:59Z", "2026-11-04", "2026-11-10")]
    [InlineData("2026-11-04T22:00:00Z", "2026-11-05", "2026-11-11")]
    // Summer, UTC+3: midnight in Vilnius is 21:00 UTC.
    [InlineData("2026-07-01T20:59:59Z", "2026-07-01", "2026-07-07")]
    [InlineData("2026-07-01T21:00:00Z", "2026-07-02", "2026-07-08")]
    // Clocks move forward on 2027-03-28 at 03:00 local time (01:00 UTC).
    [InlineData("2027-03-27T21:59:59Z", "2027-03-27", "2027-04-02")]
    [InlineData("2027-03-27T22:00:00Z", "2027-03-28", "2027-04-03")]
    [InlineData("2027-03-28T01:30:00Z", "2027-03-28", "2027-04-03")]
    // Year change.
    [InlineData("2026-12-27T22:30:00Z", "2026-12-28", "2027-01-03")]
    public void GetCurrent_ReturnsTodayInLithuaniaAndSixDaysLater(string utcNow, string firstDate, string lastDate)
    {
        var period = new ForecastPeriod(new FixedTimeProvider(DateTimeOffset.Parse(utcNow)));

        var (first, last) = period.GetCurrent();

        Assert.Equal(DateOnly.Parse(firstDate), first);
        Assert.Equal(DateOnly.Parse(lastDate), last);
        Assert.Equal(first.AddDays(ForecastPeriod.Days - 1), last);
    }

    [Theory]
    [InlineData("2026-11-10T12:20:00Z", "2026-11-10T14:20:00+02:00")]
    [InlineData("2026-07-01T11:00:00Z", "2026-07-01T14:00:00+03:00")]
    public void GetNow_IsTheClocksInstantWithTheLithuanianOffset(string utcNow, string lithuanian)
    {
        var period = new ForecastPeriod(new FixedTimeProvider(DateTimeOffset.Parse(utcNow)));

        var now = period.GetNow();

        var expected = DateTimeOffset.Parse(lithuanian);
        Assert.Equal(expected, now);
        Assert.Equal(expected.Offset, now.Offset);
        Assert.Equal(expected.Hour, now.Hour);
    }

    [Theory]
    // Winter, UTC+2; the seconds are dropped, not rounded.
    [InlineData("2026-11-10T12:05:59Z", 14, 5)]
    // Summer, UTC+3.
    [InlineData("2026-07-01T12:05:59Z", 15, 5)]
    // An instant with another offset is converted, not read as it is.
    [InlineData("2026-11-10T09:30:00-05:00", 16, 30)]
    public void ToLithuanianMinute_GivesTheLithuanianTimeToTheMinute(string instant, int hour, int minute)
    {
        Assert.Equal(new TimeOnly(hour, minute), ForecastPeriod.ToLithuanianMinute(DateTimeOffset.Parse(instant)));
    }
}
