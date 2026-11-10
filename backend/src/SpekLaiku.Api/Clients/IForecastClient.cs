namespace SpekLaiku.Api.Clients;

/// <summary>
/// Gets the hourly forecast and the daylight times for a position. The interface exists so tests can
/// replace the external service with fake responses (constitution III).
/// </summary>
public interface IForecastClient
{
    /// <summary>
    /// The forecast from <paramref name="firstDate"/> to <paramref name="lastDate"/> (Lithuanian dates).
    /// Throws <see cref="ExternalServiceException"/> for <see cref="ExternalService.Forecast"/> on every failure.
    /// </summary>
    Task<HourlyForecast> GetAsync(
        double latitude,
        double longitude,
        DateOnly firstDate,
        DateOnly lastDate,
        CancellationToken cancellationToken);
}
