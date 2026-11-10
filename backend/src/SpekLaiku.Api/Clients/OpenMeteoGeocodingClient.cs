using System.Net;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Calls the Open-Meteo geocoding API (research sections 1 and 4). Every failure becomes an
/// <see cref="ExternalServiceException"/> after one warning that names only the kind of failure and the
/// status code: the search text and the place id are never logged (spec FR-008). The HTTP and JSON
/// handling is shared with the forecast client in <see cref="ExternalServiceJson"/>.
/// </summary>
public sealed class OpenMeteoGeocodingClient(HttpClient httpClient, ILogger<OpenMeteoGeocodingClient> logger)
    : IGeocodingClient
{
    public static readonly Uri BaseAddress = new("https://geocoding-api.open-meteo.com/");

    /// <summary>Well inside the page's 10 seconds, so the user gets the service message (research section 4).</summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(5);

    private const int MaxResults = 10;

    public async Task<IReadOnlyList<GeocodingPlace>> SearchAsync(string text, CancellationToken cancellationToken)
    {
        var path = $"v1/search?name={Uri.EscapeDataString(text)}&count={MaxResults}&language=en&countryCode=LT&format=json";
        var answer = await ExternalServiceJson.GetAsync<OpenMeteoSearchResponse>(
            httpClient, path, ExternalService.LocationSearch, logger, badRequestMeansNotFound: false, cancellationToken);

        return answer?.Results?.Select(place => place.ToPlace()).OfType<GeocodingPlace>().ToList() ?? [];
    }

    public async Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken)
    {
        // The service answers 400 "Location ID not found." for an id it does not know.
        var answer = await ExternalServiceJson.GetAsync<OpenMeteoPlace>(
            httpClient, $"v1/get?id={id}&language=en", ExternalService.LocationSearch, logger, badRequestMeansNotFound: true, cancellationToken);
        if (answer is null)
        {
            return null;
        }

        return answer.ToPlace()
            ?? throw ExternalServiceJson.Failure(
                ExternalService.LocationSearch, logger, FailureKind.InvalidResponse, (int)HttpStatusCode.OK);
    }
}
