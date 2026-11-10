namespace SpekLaiku.Api.Clients;

/// <summary>
/// The external services the API calls. Feature 007 adds the map service here (research section 4).
/// </summary>
public enum ExternalService
{
    LocationSearch,

    /// <summary>The Open-Meteo hourly forecast (feature 006).</summary>
    Forecast
}
