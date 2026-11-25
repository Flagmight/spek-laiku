using System.Net;
using System.Text;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api.Clients;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The Overpass map data client, against fake answers shaped like the real ones (research sections 4 and 7).
/// </summary>
public sealed class OverpassMapPlacesClientTests : IDisposable
{
    private const double Latitude = 54.8972;
    private const double Longitude = 23.8861;

    private static readonly string[] KayakingTags = ["leisure=slipway", "sport=canoe", "leisure=slipway"];

    private static readonly MapDataServer MainServer =
        new(new Uri("https://overpass.test/"), MapDataServerRole.Main, TimeSpan.FromSeconds(4));

    private readonly CapturingLoggerProvider logs = new();
    private readonly ILoggerFactory loggerFactory;

    public OverpassMapPlacesClientTests()
    {
        loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));
    }

    [Fact]
    public async Task FindAsync_PostsOneQueryWithOneStatementPerDistinctTag()
    {
        var request = await CaptureRequestAsync(KayakingTags);

        Assert.Equal(HttpMethod.Post, request.Method);
        Assert.Equal("/api/interpreter", request.Uri.AbsolutePath);
        Assert.Equal("application/x-www-form-urlencoded", request.ContentType);
        Assert.Equal(
            "[out:json][timeout:4];\n"
            + "(\n"
            + "  nwr[\"leisure\"=\"slipway\"][\"name\"](around:30000,54.89720,23.88610);\n"
            + "  nwr[\"sport\"=\"canoe\"][\"name\"](around:30000,54.89720,23.88610);\n"
            + ");\n"
            + "out tags center qt;",
            request.Query);
    }

    [Fact]
    public async Task FindAsync_PostsToTheServersInterpreter()
    {
        var request = await CaptureRequestAsync(KayakingTags);

        Assert.Equal(new Uri("https://overpass.test/api/interpreter"), request.Uri);
    }

    [Fact]
    public async Task FindAsync_KeepsThePathOfAnAddressWithAPath()
    {
        var mirror = MainServer with { Address = new Uri("https://mirror.test/overpass/") };

        var request = await CaptureRequestAsync(KayakingTags, mirror);

        Assert.Equal(new Uri("https://mirror.test/overpass/api/interpreter"), request.Uri);
    }

    [Theory]
    [InlineData(3000, "[out:json][timeout:3];")]
    [InlineData(1500, "[out:json][timeout:1];")]
    [InlineData(400, "[out:json][timeout:1];")]
    public async Task FindAsync_PutsTheAttemptTimeInTheQuery(int milliseconds, string expectedStart)
    {
        var request = await CaptureRequestAsync(KayakingTags, timeout: TimeSpan.FromMilliseconds(milliseconds));

        Assert.StartsWith(expectedStart, request.Query);
    }

    [Fact]
    public async Task FindAsync_SendsTheIdentifyingUserAgent()
    {
        var request = await CaptureRequestAsync(KayakingTags);

        Assert.Equal("SpekLaiku/1.0", request.UserAgent);
    }

    [Fact]
    public async Task FindAsync_EscapesQuotesAndBackslashesInTags()
    {
        var request = await CaptureRequestAsync(["a\"b=c\\d"]);

        Assert.Contains("nwr[\"a\\\"b\"=\"c\\\\d\"][\"name\"]", request.Query);
    }

    [Fact]
    public async Task FindAsync_ReadsNodesAndTheCentresOfWays()
    {
        var elements = await FindAsync("""
            {"elements":[
              {"type":"node","id":1,"lat":54.9,"lon":23.9,"tags":{"name":"Nemuno slipway","leisure":"slipway"}},
              {"type":"way","id":2,"center":{"lat":54.8,"lon":23.8},"tags":{"name":"Kauno marios","sport":"canoe"}}
            ]}
            """);

        Assert.Equal(2, elements.Count);
        Assert.Equal("node/1", elements[0].Key);
        Assert.Equal(54.9, elements[0].Latitude);
        Assert.Equal(23.9, elements[0].Longitude);
        Assert.Equal("slipway", elements[0].Tags["leisure"]);
        Assert.Equal("way/2", elements[1].Key);
        Assert.Equal(54.8, elements[1].Latitude);
        Assert.Equal(23.8, elements[1].Longitude);
        Assert.Equal("Kauno marios", elements[1].Tags["name"]);
    }

    [Fact]
    public async Task FindAsync_SkipsAnElementWithoutAPosition()
    {
        var elements = await FindAsync("""
            {"elements":[
              {"type":"relation","id":3,"tags":{"name":"Route"}},
              {"type":"node","id":4,"lat":54.9,"lon":23.9,"tags":{"name":"Kept"}}
            ]}
            """);

        Assert.Equal("node/4", Assert.Single(elements).Key);
    }

    [Fact]
    public async Task FindAsync_GivesAnElementWithoutTagsAnEmptyTagList()
    {
        var elements = await FindAsync("""{"elements":[{"type":"node","id":5,"lat":54.9,"lon":23.9}]}""");

        Assert.Empty(Assert.Single(elements).Tags);
    }

    [Theory]
    [InlineData("runtime error: Query timed out in \"query\" at line 3 after 4 seconds.", FailureKind.Timeout)]
    [InlineData("runtime error: Query run out of memory using about 2048 MB of RAM.", FailureKind.InvalidResponse)]
    public async Task RuntimeErrorRemark_IsAFailureEvenWithElements(string remark, FailureKind kind)
    {
        var body = $$"""{"remark":"{{remark.Replace("\"", "\\\"")}}","elements":[{"type":"node","id":1,"lat":54.9,"lon":23.9}]}""";

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(body));

        Assert.Equal(kind, exception.Kind);
        Assert.Equal(ExternalService.MapData, exception.Service);
        AssertOneWarningWithoutTheRequest(kind.ToString());
    }

    [Fact]
    public async Task NoAnswerWithinTimeout_ThrowsTimeout()
    {
        var handler = new FakeHttpMessageHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromSeconds(10), token);
            return new HttpResponseMessage(HttpStatusCode.OK);
        });

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(
            () => FindAsync(handler, timeout: TimeSpan.FromMilliseconds(200)));

        Assert.Equal(FailureKind.Timeout, exception.Kind);
        Assert.Equal(ExternalService.MapData, exception.Service);
        AssertOneWarningWithoutTheRequest("Timeout");
    }

    [Fact]
    public async Task SlowAnswerWithinTheAttemptTime_IsUsed()
    {
        var handler = new FakeHttpMessageHandler(async (_, token) =>
        {
            await Task.Delay(TimeSpan.FromMilliseconds(300), token);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    """{"elements":[{"type":"node","id":7,"lat":54.9,"lon":23.9,"tags":{"name":"Slow"}}]}""",
                    Encoding.UTF8,
                    "application/json")
            };
        });

        // A wide margin over the 300 ms answer, so a slow CI runner does not turn it into a timeout.
        var elements = await FindAsync(handler, timeout: TimeSpan.FromSeconds(5));

        Assert.Equal("node/7", Assert.Single(elements).Key);
        Assert.Empty(logs.Entries);
    }

    [Fact]
    public async Task CancelledRequest_IsNotATimeout()
    {
        using var cancelled = new CancellationTokenSource();
        await cancelled.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => FindAsync(FakeHttpMessageHandler.Json("""{"elements":[]}"""), cancellationToken: cancelled.Token));

        Assert.Empty(logs.Entries);
    }

    [Fact]
    public async Task FailureWarning_NamesTheRoleAndNeverTheAddress()
    {
        var fallback = new MapDataServer(
            new Uri("https://secret-user:secret-pass@mirror.test/"), MapDataServerRole.Fallback, TimeSpan.FromSeconds(4));

        await Assert.ThrowsAsync<ExternalServiceException>(
            () => FindAsync(FakeHttpMessageHandler.Json("{}", HttpStatusCode.BadGateway), fallback));

        var entry = Assert.Single(logs.Entries);
        Assert.Contains("on the fallback server", entry);
        Assert.DoesNotContain("mirror.test", entry);
        Assert.DoesNotContain("secret", entry);
    }

    [Fact]
    public async Task NetworkError_ThrowsNetwork()
    {
        var handler = FakeHttpMessageHandler.Throws(new HttpRequestException("No such host is known."));

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(handler));

        Assert.Equal(FailureKind.Network, exception.Kind);
        AssertOneWarningWithoutTheRequest("Network");
    }

    [Theory]
    [InlineData(HttpStatusCode.TooManyRequests)]
    [InlineData(HttpStatusCode.GatewayTimeout)]
    [InlineData(HttpStatusCode.BadRequest)]
    public async Task UnsuccessfulStatus_ThrowsUnexpectedStatus(HttpStatusCode status)
    {
        var handler = FakeHttpMessageHandler.Json("{}", status);

        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(handler));

        Assert.Equal(FailureKind.UnexpectedStatus, exception.Kind);
        Assert.Equal((int)status, exception.StatusCode);
        AssertOneWarningWithoutTheRequest("UnexpectedStatus");
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    [InlineData("""{"version":0.6}""")]
    public async Task UnreadableOrIncompleteAnswer_ThrowsInvalidResponse(string body)
    {
        var exception = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(body));

        Assert.Equal(FailureKind.InvalidResponse, exception.Kind);
        AssertOneWarningWithoutTheRequest("InvalidResponse");
    }

    public void Dispose()
    {
        loggerFactory.Dispose();
        logs.Dispose();
    }

    private async Task<CapturedRequest> CaptureRequestAsync(
        IReadOnlyList<string> tags,
        MapDataServer? server = null,
        TimeSpan? timeout = null)
    {
        CapturedRequest? captured = null;
        var handler = new FakeHttpMessageHandler(async (request, token) =>
        {
            var body = await request.Content!.ReadAsStringAsync(token);
            Assert.StartsWith("data=", body);
            captured = new CapturedRequest(
                request.Method,
                request.RequestUri!,
                request.Content.Headers.ContentType?.MediaType,
                request.Headers.UserAgent.ToString(),
                WebUtility.UrlDecode(body["data=".Length..]));
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("""{"elements":[]}""", Encoding.UTF8, "application/json")
            };
        });

        var chosen = server ?? MainServer;
        await CreateClient(handler)
            .FindAsync(chosen, timeout ?? chosen.Timeout, Latitude, Longitude, 30, tags, CancellationToken.None);

        return captured!;
    }

    private Task<IReadOnlyList<MapElement>> FindAsync(string body) => FindAsync(FakeHttpMessageHandler.Json(body));

    private Task<IReadOnlyList<MapElement>> FindAsync(
        FakeHttpMessageHandler handler,
        MapDataServer? server = null,
        TimeSpan? timeout = null,
        CancellationToken cancellationToken = default)
    {
        var chosen = server ?? MainServer;
        return CreateClient(handler).FindAsync(
            chosen, timeout ?? chosen.Timeout, Latitude, Longitude, 30, KayakingTags, cancellationToken);
    }

    // Built as Program builds it, so the backstop timeout and agent are the real ones.
    private OverpassMapPlacesClient CreateClient(HttpMessageHandler handler)
    {
        var httpClient = new HttpClient(handler);
        OverpassMapPlacesClient.Configure(httpClient);
        return new OverpassMapPlacesClient(httpClient, loggerFactory.CreateLogger<OverpassMapPlacesClient>());
    }

    private void AssertOneWarningWithoutTheRequest(string kind)
    {
        var entry = Assert.Single(logs.Entries);
        Assert.Contains("Warning", entry);
        Assert.Contains("Map data service failed", entry);
        Assert.Contains(kind, entry);
        Assert.DoesNotContain("54.89", entry);
        Assert.DoesNotContain("54,89", entry);
        Assert.DoesNotContain("23.88", entry);
        Assert.DoesNotContain("23,88", entry);
        Assert.DoesNotContain("30000", entry);
        Assert.DoesNotContain("around", entry);
        Assert.DoesNotContain("slipway", entry);
        Assert.DoesNotContain("canoe", entry);
    }

    private sealed record CapturedRequest(
        HttpMethod Method,
        Uri Uri,
        string? ContentType,
        string UserAgent,
        string Query);
}
