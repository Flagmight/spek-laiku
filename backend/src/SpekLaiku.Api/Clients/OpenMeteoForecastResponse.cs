using System.Text.Json.Serialization;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// The forecast answer with <c>timeformat=unixtime</c>: every time is unix seconds, and the arrays of a
/// block line up by position with its <c>time</c> array (research section 1). Other fields are ignored.
/// </summary>
internal sealed record OpenMeteoForecastResponse(
    [property: JsonPropertyName("hourly")] OpenMeteoHourly? Hourly,
    [property: JsonPropertyName("daily")] OpenMeteoDaily? Daily)
{
    /// <summary>
    /// The forecast, or <c>null</c> when the answer is incomplete: a block or array is missing, arrays of a
    /// block differ in length, or a date from <paramref name="firstDate"/> to <paramref name="lastDate"/>
    /// has no sunrise or sunset. Missing hourly values stay <c>null</c>.
    /// </summary>
    public HourlyForecast? ToForecast(DateOnly firstDate, DateOnly lastDate, TimeZoneInfo timeZone)
    {
        var hours = Hourly?.ToHours();
        var daylight = Daily?.ToDaylight(timeZone);
        if (hours is null || daylight is null)
        {
            return null;
        }

        var days = new List<ForecastDaylight>();
        for (var date = firstDate; date <= lastDate; date = date.AddDays(1))
        {
            if (!daylight.TryGetValue(date, out var day))
            {
                return null;
            }

            days.Add(day);
        }

        return new HourlyForecast(hours, days);
    }
}

internal sealed record OpenMeteoHourly(
    [property: JsonPropertyName("time")] long[]? Time,
    [property: JsonPropertyName("temperature_2m")] double?[]? Temperature,
    [property: JsonPropertyName("precipitation")] double?[]? Precipitation,
    [property: JsonPropertyName("wind_speed_10m")] double?[]? WindSpeed)
{
    public List<ForecastHourValues>? ToHours()
    {
        if (Time is null
            || Temperature?.Length != Time.Length
            || Precipitation?.Length != Time.Length
            || WindSpeed?.Length != Time.Length)
        {
            return null;
        }

        return Time
            .Select((seconds, index) => new ForecastHourValues(
                DateTimeOffset.FromUnixTimeSeconds(seconds),
                Temperature[index],
                Precipitation[index],
                WindSpeed[index]))
            .ToList();
    }
}

internal sealed record OpenMeteoDaily(
    [property: JsonPropertyName("time")] long[]? Time,
    [property: JsonPropertyName("sunrise")] long?[]? Sunrise,
    [property: JsonPropertyName("sunset")] long?[]? Sunset)
{
    /// <summary>The days that have both times, by Lithuanian date; <c>null</c> when the arrays do not line up.</summary>
    public Dictionary<DateOnly, ForecastDaylight>? ToDaylight(TimeZoneInfo timeZone)
    {
        if (Time is null || Sunrise?.Length != Time.Length || Sunset?.Length != Time.Length)
        {
            return null;
        }

        var days = new Dictionary<DateOnly, ForecastDaylight>();
        for (var index = 0; index < Time.Length; index++)
        {
            if (Sunrise[index] is not { } sunrise || Sunset[index] is not { } sunset)
            {
                continue;
            }

            // Each day's time is its local midnight, so converting it gives the Lithuanian date.
            var midnight = TimeZoneInfo.ConvertTime(DateTimeOffset.FromUnixTimeSeconds(Time[index]), timeZone);
            var date = DateOnly.FromDateTime(midnight.DateTime);
            days[date] = new ForecastDaylight(
                date,
                DateTimeOffset.FromUnixTimeSeconds(sunrise),
                DateTimeOffset.FromUnixTimeSeconds(sunset));
        }

        return days;
    }
}
