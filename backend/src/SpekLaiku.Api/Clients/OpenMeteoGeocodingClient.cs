using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Calls the Open-Meteo geocoding API (research sections 1 and 4). Every failure becomes an
/// <see cref="ExternalServiceException"/> after one warning that names only the kind of failure and the
/// status code: the search text and the place id are never logged (spec FR-008).
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
        var answer = await GetJsonAsync<OpenMeteoSearchResponse>(path, badRequestMeansNotFound: false, cancellationToken);

        return answer?.Results?.Select(place => place.ToPlace()).OfType<GeocodingPlace>().ToList() ?? [];
    }

    public async Task<GeocodingPlace?> GetAsync(long id, CancellationToken cancellationToken)
    {
        // The service answers 400 "Location ID not found." for an id it does not know.
        var answer = await GetJsonAsync<OpenMeteoPlace>($"v1/get?id={id}&language=en", badRequestMeansNotFound: true, cancellationToken);
        if (answer is null)
        {
            return null;
        }

        return answer.ToPlace() ?? throw Failure(FailureKind.InvalidResponse, (int)HttpStatusCode.OK);
    }

    /// <summary>The body, or <c>null</c> only when <paramref name="badRequestMeansNotFound"/> and the answer is 400.</summary>
    private async Task<T?> GetJsonAsync<T>(string path, bool badRequestMeansNotFound, CancellationToken cancellationToken)
        where T : class
    {
        HttpResponseMessage response;
        try
        {
            response = await httpClient.GetAsync(path, cancellationToken);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw Failure(FailureKind.Timeout, null, exception);
        }
        catch (HttpRequestException exception)
        {
            throw Failure(FailureKind.Network, null, exception);
        }

        using (response)
        {
            var status = (int)response.StatusCode;
            if (badRequestMeansNotFound && response.StatusCode == HttpStatusCode.BadRequest)
            {
                return null;
            }

            if (!response.IsSuccessStatusCode)
            {
                throw Failure(FailureKind.UnexpectedStatus, status);
            }

            T? body;
            try
            {
                body = await response.Content.ReadFromJsonAsync<T>(cancellationToken);
            }
            catch (JsonException exception)
            {
                throw Failure(FailureKind.InvalidResponse, status, exception);
            }
            catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
            {
                throw Failure(FailureKind.Timeout, status, exception);
            }
            catch (HttpRequestException exception)
            {
                throw Failure(FailureKind.Network, status, exception);
            }

            return body ?? throw Failure(FailureKind.InvalidResponse, status);
        }
    }

    private ExternalServiceException Failure(FailureKind kind, int? statusCode, Exception? inner = null)
    {
        logger.LogWarning("Location search service failed: {FailureKind} {StatusCode}", kind, statusCode);
        return new ExternalServiceException(ExternalService.LocationSearch, kind, statusCode, inner);
    }
}
