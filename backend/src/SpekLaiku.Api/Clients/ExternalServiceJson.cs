using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Reads a JSON answer from an external service and turns every failure into an
/// <see cref="ExternalServiceException"/> after one warning (research section 11). The warning names only
/// the service, the kind of failure and the status code: never the request address, which can hold a
/// search text, a position or dates. Shared by the Open-Meteo geocoding and forecast clients.
/// </summary>
internal static class ExternalServiceJson
{
    /// <summary>
    /// The body, or <c>null</c> only when <paramref name="badRequestMeansNotFound"/> and the answer is 400.
    /// </summary>
    public static async Task<T?> GetAsync<T>(
        HttpClient httpClient,
        string path,
        ExternalService service,
        ILogger logger,
        bool badRequestMeansNotFound,
        CancellationToken cancellationToken)
        where T : class
    {
        HttpResponseMessage response;
        try
        {
            response = await httpClient.GetAsync(path, cancellationToken);
        }
        catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
        {
            throw Failure(service, logger, FailureKind.Timeout, null, exception);
        }
        catch (HttpRequestException exception)
        {
            throw Failure(service, logger, FailureKind.Network, null, exception);
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
                throw Failure(service, logger, FailureKind.UnexpectedStatus, status);
            }

            T? body;
            try
            {
                body = await response.Content.ReadFromJsonAsync<T>(cancellationToken);
            }
            catch (JsonException exception)
            {
                throw Failure(service, logger, FailureKind.InvalidResponse, status, exception);
            }
            catch (TaskCanceledException exception) when (!cancellationToken.IsCancellationRequested)
            {
                throw Failure(service, logger, FailureKind.Timeout, status, exception);
            }
            catch (HttpRequestException exception)
            {
                throw Failure(service, logger, FailureKind.Network, status, exception);
            }

            return body ?? throw Failure(service, logger, FailureKind.InvalidResponse, status);
        }
    }

    /// <summary>Logs the one warning for a failure and returns the exception to throw.</summary>
    public static ExternalServiceException Failure(
        ExternalService service,
        ILogger logger,
        FailureKind kind,
        int? statusCode,
        Exception? inner = null)
    {
        logger.LogWarning("{Service} failed: {FailureKind} {StatusCode}", DisplayName(service), kind, statusCode);
        return new ExternalServiceException(service, kind, statusCode, inner);
    }

    private static string DisplayName(ExternalService service) => service switch
    {
        ExternalService.LocationSearch => "Location search service",
        ExternalService.Forecast => "Forecast service",
        _ => service.ToString()
    };
}
