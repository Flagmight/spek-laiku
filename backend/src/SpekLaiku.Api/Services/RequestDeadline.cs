namespace SpekLaiku.Api.Services;

/// <summary>
/// The 9-second limit of one place or schedule request (feature 017 spec FR-007; research section 4). The page
/// gives up after 10 seconds, so the location lookup, the forecast and every map data attempt together must end
/// within 9 seconds, leaving time to build and send the answer. It starts on the first line of the services that
/// answer those requests, not in middleware, so it covers exactly the work they do. It uses the
/// <see cref="ForecastPeriod"/> clock, which the tests control, so the integration tests can move time instead of
/// waiting. One deadline belongs to one request; it is passed as an argument and never stored or shared.
/// </summary>
public sealed class RequestDeadline
{
    /// <summary>How long one request may take in total.</summary>
    public static readonly TimeSpan Limit = TimeSpan.FromSeconds(9);

    /// <summary>A map data server is not contacted with less time than this.</summary>
    public static readonly TimeSpan ShortestAttempt = TimeSpan.FromSeconds(1);

    private readonly ForecastPeriod clock;
    private readonly DateTimeOffset start;

    private RequestDeadline(ForecastPeriod clock, DateTimeOffset start)
    {
        this.clock = clock;
        this.start = start;
    }

    /// <summary>The time left before the limit, never below zero.</summary>
    public TimeSpan Remaining
    {
        get
        {
            var remaining = start + Limit - clock.GetNow();
            return remaining > TimeSpan.Zero ? remaining : TimeSpan.Zero;
        }
    }

    /// <summary>Starts the limit now, on <paramref name="clock"/>.</summary>
    public static RequestDeadline Start(ForecastPeriod clock) => new(clock, clock.GetNow());
}
