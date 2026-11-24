using System.Net;

namespace SpekLaiku.Api.Clients;

/// <summary>
/// Calls an OpenStreetMap Overpass API server once per attempt with one query for every tag (feature 007 research
/// sections 4 and 7). The caller chooses the server and the attempt time (feature 017 research sections 5 and 9).
/// Every failure, including an answer cut short by the service's own limits and an attempt that runs out of time,
/// becomes an <see cref="ExternalServiceException"/> after one warning that names the server's role, never its
/// address, the position, the radius or the tags.
/// </summary>
public sealed class OverpassMapPlacesClient(HttpClient httpClient, ILogger<OverpassMapPlacesClient> logger)
    : IMapPlacesClient
{
    public const string Path = "api/interpreter";

    /// <summary>
    /// Only a backstop: each attempt has its own, shorter time (feature 017 research section 5). It is longer than
    /// any attempt can be, so it never decides the outcome of a working request.
    /// </summary>
    public static readonly TimeSpan BackstopTimeout = TimeSpan.FromSeconds(10);

    /// <summary>
    /// The Overpass usage policy asks for an identifying agent. It holds no personal or contact details.
    /// </summary>
    public const string UserAgent = "SpekLaiku/1.0";

    /// <summary>The backstop timeout and agent of the client; used by <c>Program</c> and the tests.</summary>
    public static void Configure(HttpClient client)
    {
        client.Timeout = BackstopTimeout;
        client.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
    }

    public async Task<IReadOnlyList<MapElement>> FindAsync(
        MapDataServer server,
        TimeSpan timeout,
        double latitude,
        double longitude,
        int radiusKm,
        IReadOnlyList<string> tags,
        CancellationToken cancellationToken)
    {
        var role = server.Role.ToLogName();
        var query = OverpassQuery.Build(latitude, longitude, radiusKm, tags, Math.Max(1, (int)timeout.TotalSeconds));

        using var attempt = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        attempt.CancelAfter(timeout);

        OverpassResponse? answer;
        try
        {
            // Without badRequestMeansNotFound the answer is never null: every failure throws.
            answer = await ExternalServiceJson.PostFormAsync<OverpassResponse>(
                httpClient,
                new Uri(server.Address, Path).ToString(),
                [new("data", query)],
                ExternalService.MapData,
                logger,
                attempt.Token,
                server: role);
        }
        catch (OperationCanceledException exception)
            when (attempt.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            throw ExternalServiceJson.Failure(
                ExternalService.MapData, logger, FailureKind.Timeout, null, inner: exception, server: role);
        }

        if (answer!.Remark is { } remark && remark.Contains("runtime error", StringComparison.OrdinalIgnoreCase))
        {
            var kind = remark.Contains("timed out", StringComparison.OrdinalIgnoreCase)
                ? FailureKind.Timeout
                : FailureKind.InvalidResponse;
            throw ExternalServiceJson.Failure(
                ExternalService.MapData, logger, kind, (int)HttpStatusCode.OK, server: role);
        }

        if (answer.Elements is null)
        {
            throw ExternalServiceJson.Failure(
                ExternalService.MapData, logger, FailureKind.InvalidResponse, (int)HttpStatusCode.OK, server: role);
        }

        // An element without a position (a relation without a centre) cannot be placed, so it is left out.
        return answer.Elements
            .Select(element => element.ToMapElement())
            .OfType<MapElement>()
            .ToList();
    }
}
