using System.Globalization;
using System.Net;
using SpekLaiku.Api.Services;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Calls the Open-Meteo forecast API (research sections 1 and 11): temperature 2 m above ground (°C),
/// precipitation (mm, rain, showers and snow) and wind 10 m above ground (m/s) per hour, and sunrise and
/// sunset per day, as unix times. Every failure, including an incomplete answer, becomes an
/// <see cref="ExternalServiceException"/> after one warning that never names the position or the dates.
/// </summary>
public sealed class OpenMeteoForecastClient(HttpClient httpClient, ILogger<OpenMeteoForecastClient> logger)
    : IForecastClient
{
    public static readonly Uri BaseAddress = new("https://api.open-meteo.com/");

    /// <summary>
    /// The page waits 10 seconds. An uncached location lookup may take up to 5 of them, so the forecast gets 4
    /// and the user still sees the weather service message instead of a general error (research section 11).
    /// </summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(4);

    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById(ForecastPeriod.TimeZoneId);

    public async Task<HourlyForecast> GetAsync(
        double latitude,
        double longitude,
        DateOnly firstDate,
        DateOnly lastDate,
        CancellationToken cancellationToken)
    {
        var invariant = CultureInfo.InvariantCulture;
        var path = "v1/forecast"
            + $"?latitude={latitude.ToString(invariant)}&longitude={longitude.ToString(invariant)}"
            + "&hourly=temperature_2m,precipitation,wind_speed_10m&daily=sunrise,sunset&wind_speed_unit=ms"
            + $"&timezone={Uri.EscapeDataString(ForecastPeriod.TimeZoneId)}&timeformat=unixtime"
            + $"&start_date={firstDate.ToString("yyyy-MM-dd", invariant)}&end_date={lastDate.ToString("yyyy-MM-dd", invariant)}";

        // Without badRequestMeansNotFound the answer is never null: every failure throws.
        var answer = await ExternalServiceJson.GetAsync<OpenMeteoForecastResponse>(
            httpClient, path, ExternalService.Forecast, logger, badRequestMeansNotFound: false, cancellationToken);

        return answer!.ToForecast(firstDate, lastDate, Lithuania)
            ?? throw ExternalServiceJson.Failure(
                ExternalService.Forecast, logger, FailureKind.InvalidResponse, (int)HttpStatusCode.OK);
    }
}
