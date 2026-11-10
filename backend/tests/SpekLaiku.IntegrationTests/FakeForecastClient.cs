using System.Collections.Concurrent;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Stands in for the Open-Meteo forecast service, so no test calls the live service (constitution III).
/// Answers are scripted per position; a position that is not scripted gets an invalid answer, as from a
/// broken service. The API caches forecasts per location id and day in a cache shared by the test
/// collection, so every test uses its own place id and position (research section 4).
/// </summary>
public sealed class FakeForecastClient : IForecastClient
{
    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById("Europe/Vilnius");

    private readonly ConcurrentDictionary<(double, double), HourlyForecast> answers = new();
    private readonly ConcurrentDictionary<(double, double), FailureKind> failures = new();
    private int calls;

    public int Calls => calls;

    /// <summary>A forecast for this position returns <paramref name="forecast"/>.</summary>
    public void Script(double latitude, double longitude, HourlyForecast forecast) =>
        answers[(latitude, longitude)] = forecast;

    /// <summary>A forecast for this position fails like the real client does.</summary>
    public void ScriptFailure(double latitude, double longitude, FailureKind kind) =>
        failures[(latitude, longitude)] = kind;

    public Task<HourlyForecast> GetAsync(
        double latitude,
        double longitude,
        DateOnly firstDate,
        DateOnly lastDate,
        CancellationToken cancellationToken)
    {
        Interlocked.Increment(ref calls);
        if (failures.TryGetValue((latitude, longitude), out var kind))
        {
            throw new ExternalServiceException(ExternalService.Forecast, kind);
        }

        return answers.TryGetValue((latitude, longitude), out var forecast)
            ? Task.FromResult(forecast)
            : throw new ExternalServiceException(ExternalService.Forecast, FailureKind.InvalidResponse);
    }

    /// <summary>
    /// A whole forecast for <paramref name="days"/> days from <paramref name="firstDate"/>, stamped every hour
    /// from local midnight until the next day's midnight after the last date, with the same values everywhere
    /// and the same sunrise and sunset each day.
    /// </summary>
    public static HourlyForecast Fill(
        DateOnly firstDate,
        int days,
        double temperatureC,
        double precipitationMm,
        double windSpeedMs,
        TimeOnly sunrise,
        TimeOnly sunset)
    {
        var start = Local(firstDate, TimeOnly.MinValue);
        var end = Local(firstDate.AddDays(days + 1), TimeOnly.MinValue);
        var hours = new List<ForecastHourValues>();
        for (var time = start; time < end; time = time.AddHours(1))
        {
            hours.Add(new ForecastHourValues(time, temperatureC, precipitationMm, windSpeedMs));
        }

        var daylight = Enumerable.Range(0, days)
            .Select(offset => firstDate.AddDays(offset))
            .Select(date => new ForecastDaylight(date, Local(date, sunrise), Local(date, sunset)))
            .ToList();

        return new HourlyForecast(hours, daylight);
    }

    /// <summary>
    /// Changes the planning hour <paramref name="hour"/>:00 of <paramref name="date"/>: the temperature and wind
    /// stamped at its start and the rain stamped at its end, which is how the API reads that hour.
    /// </summary>
    public static HourlyForecast WithHour(
        HourlyForecast forecast,
        DateOnly date,
        int hour,
        double? temperatureC,
        double? rainMm,
        double? windSpeedMs)
    {
        var start = Local(date, new TimeOnly(hour, 0));
        var end = start.AddHours(1);
        var hours = forecast.Hours
            .Select(values => values.Time == start
                ? values with { TemperatureC = temperatureC, WindSpeedMs = windSpeedMs }
                : values.Time == end ? values with { PrecipitationMm = rainMm } : values)
            .ToList();

        return forecast with { Hours = hours };
    }

    private static DateTimeOffset Local(DateOnly date, TimeOnly time)
    {
        var local = date.ToDateTime(time);
        return new DateTimeOffset(local, Lithuania.GetUtcOffset(local));
    }
}
