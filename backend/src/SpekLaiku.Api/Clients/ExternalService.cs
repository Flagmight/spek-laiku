namespace SpekLaiku.Api.Clients;

/// <summary>
/// The external services the API calls. Each one has its own <c>503</c> answer in <c>ApiExceptionHandler</c>.
/// </summary>
public enum ExternalService
{
    LocationSearch,

    /// <summary>The Open-Meteo hourly forecast (feature 006).</summary>
    Forecast,

    /// <summary>The OpenStreetMap Overpass API (feature 007).</summary>
    MapData
}
