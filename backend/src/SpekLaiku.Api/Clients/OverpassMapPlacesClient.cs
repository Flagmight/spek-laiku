using System.Net;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Calls the OpenStreetMap Overpass API once per place request with one query for every tag (research
/// sections 4 and 7). Every failure, including an answer cut short by the service's own limits, becomes an
/// <see cref="ExternalServiceException"/> after one warning that never names the position, radius or tags.
/// </summary>
public sealed class OverpassMapPlacesClient(HttpClient httpClient, ILogger<OverpassMapPlacesClient> logger)
    : IMapPlacesClient
{
    public static readonly Uri BaseAddress = new("https://overpass-api.de/");

    public const string Path = "api/interpreter";

    /// <summary>
    /// The page waits 10 seconds. An uncached location lookup may take up to 5 of them, so the map data
    /// service gets 4 and the user still sees its own message instead of a general error (spec FR-009).
    /// </summary>
    public static readonly TimeSpan Timeout = TimeSpan.FromSeconds(OverpassQuery.TimeoutSeconds);

    /// <summary>
    /// The Overpass usage policy asks for an identifying agent. It holds no personal or contact details.
    /// </summary>
    public const string UserAgent = "SpekLaiku/1.0";

    /// <summary>The address, timeout and agent of the client; used by <c>Program</c> and the tests.</summary>
    public static void Configure(HttpClient client)
    {
        client.BaseAddress = BaseAddress;
        client.Timeout = Timeout;
        client.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
    }

    public async Task<IReadOnlyList<MapElement>> FindAsync(
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken)
    {
        var query = OverpassQuery.Build(latitude, longitude, radiusKm, tags);

        // Without badRequestMeansNotFound the answer is never null: every failure throws.
        var answer = await ExternalServiceJson.PostFormAsync<OverpassResponse>(
            httpClient,
            Path,
            [new("data", query)],
            ExternalService.MapData,
            logger,
            cancellationToken);

        if (answer!.Remark is { } remark && remark.Contains("runtime error", StringComparison.OrdinalIgnoreCase))
        {
            var kind = remark.Contains("timed out", StringComparison.OrdinalIgnoreCase)
                ? FailureKind.Timeout
                : FailureKind.InvalidResponse;
            throw ExternalServiceJson.Failure(ExternalService.MapData, logger, kind, (int)HttpStatusCode.OK);
        }

        if (answer.Elements is null)
        {
            throw ExternalServiceJson.Failure(
                ExternalService.MapData, logger, FailureKind.InvalidResponse, (int)HttpStatusCode.OK);
        }

        // An element without a position (a relation without a centre) cannot be placed, so it is left out.
        return answer.Elements
            .Select(element => element.ToMapElement())
            .OfType<MapElement>()
            .ToList();
    }
}
