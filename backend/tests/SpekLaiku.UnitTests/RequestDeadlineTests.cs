using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The 9-second limit of one place or schedule request (feature 017 spec FR-007; research section 4).</summary>
public sealed class RequestDeadlineTests
{
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T12:05:00Z"));

    [Fact]
    public void Remaining_IsNineSecondsAtStart()
    {
        var deadline = RequestDeadline.Start(new ForecastPeriod(clock));

        Assert.Equal(TimeSpan.FromSeconds(9), deadline.Remaining);
    }

    [Fact]
    public void Remaining_ShrinksAsTheClockMoves()
    {
        var deadline = RequestDeadline.Start(new ForecastPeriod(clock));

        clock.UtcNow += TimeSpan.FromSeconds(2.5);

        Assert.Equal(TimeSpan.FromSeconds(6.5), deadline.Remaining);
    }

    [Fact]
    public void Remaining_IsNeverBelowZero()
    {
        var deadline = RequestDeadline.Start(new ForecastPeriod(clock));

        clock.UtcNow += TimeSpan.FromSeconds(12);

        Assert.Equal(TimeSpan.Zero, deadline.Remaining);
    }
}
