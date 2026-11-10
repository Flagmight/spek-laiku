using System.Globalization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// The forecast for a location over the whole current forecast period, reused for up to
/// <see cref="ForecastOptions.MaxAgeMinutes"/> (spec FR-009, research section 4). The age is checked against
/// <see cref="ForecastPeriod.GetNow"/>, the only clock the forecast services read, so tests control it.
/// Failures are not cached: they reach <c>ApiExceptionHandler</c>, and the next request asks again.
/// </summary>
public sealed class WeatherForecastService(
    IForecastClient forecastClient,
    IMemoryCache cache,
    ForecastPeriod forecastPeriod,
    IOptions<ForecastOptions> options)
{
    public async Task<ReceivedForecast> GetAsync(PlaceLocation location, CancellationToken cancellationToken)
    {
        var (firstDate, lastDate) = forecastPeriod.GetCurrent();
        var maxAge = TimeSpan.FromMinutes(options.Value.MaxAgeMinutes);

        // The first date is in the key, so yesterday's answer is never used today.
        var key = string.Create(CultureInfo.InvariantCulture, $"forecast:{location.Id}:{firstDate:yyyy-MM-dd}");
        if (cache.TryGetValue(key, out ReceivedForecast? cached)
            && cached is not null
            && forecastPeriod.GetNow() - cached.ReceivedAt < maxAge)
        {
            return cached;
        }

        var data = await forecastClient.GetAsync(location.Latitude, location.Longitude, firstDate, lastDate, cancellationToken);
        var received = new ReceivedForecast(data, forecastPeriod.GetNow());
        cache.Set(key, received, maxAge);
        return received;
    }
}
