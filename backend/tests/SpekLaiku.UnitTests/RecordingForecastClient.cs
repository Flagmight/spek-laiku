using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Stands in for the weather service in service tests: returns <see cref="Answer"/> or throws
/// <see cref="Failure"/>, and records every call so tests can see what was asked and how often.
/// </summary>
public sealed class RecordingForecastClient : IForecastClient
{
    public HourlyForecast Answer { get; set; } = new([], []);

    /// <summary>When set, every call throws it, as the real client does for a service failure.</summary>
    public ExternalServiceException? Failure { get; set; }

    public List<(double Latitude, double Longitude, DateOnly FirstDate, DateOnly LastDate)> Calls { get; } = [];

    public Task<HourlyForecast> GetAsync(
        double latitude,
        double longitude,
        DateOnly firstDate,
        DateOnly lastDate,
        CancellationToken cancellationToken)
    {
        Calls.Add((latitude, longitude, firstDate, lastDate));
        if (Failure is not null)
        {
            throw Failure;
        }

        return Task.FromResult(Answer);
    }
}
