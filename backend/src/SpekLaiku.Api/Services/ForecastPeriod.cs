namespace SpekLaiku.Api.Services;

/// <summary>
/// The dates a plan may use: today in Lithuania and the following 6 days (spec FR-010). This is the only
/// place the period is worked out; the page receives it through <c>GET /api/plan-setup/period</c> and
/// computes no dates itself (constitution I, research section 6). It is also the only clock the forecast
/// services read (feature 006, research section 3), so "today", "now" and the forecast period always agree.
/// </summary>
public sealed class ForecastPeriod(TimeProvider timeProvider)
{
    public const int Days = 7;

    public const string TimeZoneId = "Europe/Vilnius";

    /// <summary>Lithuania's time zone; the one copy every forecast class uses.</summary>
    public static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    /// <summary>The current time in Lithuania, with Lithuania's offset.</summary>
    public DateTimeOffset GetNow() => TimeZoneInfo.ConvertTime(timeProvider.GetUtcNow(), Lithuania);

    /// <summary>
    /// The instant's Lithuanian time to the minute, as the "updated at" messages show it (feature 006 FR-009,
    /// feature 007 FR-012).
    /// </summary>
    public static TimeOnly ToLithuanianMinute(DateTimeOffset instant)
    {
        var inLithuania = TimeZoneInfo.ConvertTime(instant, Lithuania);
        return new TimeOnly(inLithuania.Hour, inLithuania.Minute);
    }

    public (DateOnly FirstDate, DateOnly LastDate) GetCurrent()
    {
        var today = DateOnly.FromDateTime(GetNow().DateTime);

        return (today, today.AddDays(Days - 1));
    }
}
