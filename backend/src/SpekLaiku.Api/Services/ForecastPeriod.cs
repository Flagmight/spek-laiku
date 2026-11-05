namespace SpekLaiku.Api.Services;

/// <summary>
/// The dates a plan may use: today in Lithuania and the following 6 days (spec FR-010). This is the only
/// place the period is worked out; the page receives it through <c>GET /api/plan-setup/period</c> and
/// computes no dates itself (constitution I, research section 6).
/// </summary>
public sealed class ForecastPeriod(TimeProvider timeProvider)
{
    public const int Days = 7;

    public const string TimeZoneId = "Europe/Vilnius";

    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    public (DateOnly FirstDate, DateOnly LastDate) GetCurrent()
    {
        var nowInLithuania = TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Lithuania);
        var today = DateOnly.FromDateTime(nowInLithuania.DateTime);

        return (today, today.AddDays(Days - 1));
    }
}
