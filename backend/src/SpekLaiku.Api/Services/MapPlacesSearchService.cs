using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.Api.Services;

/// <summary>
/// Searches the map data for places, trying the main server and then the fallback server when one is configured
/// (feature 017 spec FR-007, FR-009 to FR-014; research sections 5 to 7). The first answer is used, even one
/// without places (FR-010). Only a map data service failure moves on to the next server (FR-009); a cancelled
/// request or any other exception passes through at once. Each server is asked at most once per request (FR-014).
/// Each attempt gets the server's waiting time or what is left of the request's deadline, whichever is shorter;
/// with less than <see cref="RequestDeadline.ShortestAttempt"/> left, no further server is contacted (FR-007).
/// When every attempt fails, the last failure is thrown (FR-012); when no server could be contacted at all, the
/// failure is a timeout. Each failed attempt has already been logged by the client with its server role (FR-013).
/// </summary>
public sealed class MapPlacesSearchService(
    IMapPlacesClient client,
    IOptions<MapDataOptions> options,
    ILogger<MapPlacesSearchService> logger)
{
    /// <summary>
    /// The places within <paramref name="radiusKm"/> of the position that have at least one of the
    /// <paramref name="tags"/>, from the first map data server that answers before <paramref name="deadline"/>.
    /// </summary>
    public async Task<IReadOnlyList<MapElement>> FindAsync(
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        RequestDeadline deadline,
        CancellationToken cancellationToken)
    {
        ExternalServiceException? lastFailure = null;
        foreach (var server in options.Value.Servers())
        {
            var remaining = deadline.Remaining;
            var time = server.Timeout < remaining ? server.Timeout : remaining;
            if (time < RequestDeadline.ShortestAttempt)
            {
                // Neither the address nor the request is logged (FR-013).
                logger.LogWarning(
                    "Map data service not contacted: no time left for the {Server} server",
                    server.Role.ToLogName());
                break;
            }

            try
            {
                return await client.FindAsync(server, time, latitude, longitude, radiusKm, tags, cancellationToken);
            }
            catch (ExternalServiceException failure) when (failure.Service == ExternalService.MapData)
            {
                lastFailure = failure;
            }
        }

        throw lastFailure ?? new ExternalServiceException(ExternalService.MapData, FailureKind.Timeout);
    }
}
