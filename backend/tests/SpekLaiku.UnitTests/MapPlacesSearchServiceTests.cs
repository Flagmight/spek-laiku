using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// Trying the main map data server and then the fallback (feature 017 spec FR-007, FR-009 to FR-014; research
/// sections 5 to 7): the first answer is used, only a map data failure moves on, each server is asked at most
/// once, the last failure is thrown when every server fails, and no attempt goes past the request's 9-second
/// deadline. The clock is moved from the fake client instead of waiting.
/// </summary>
public sealed class MapPlacesSearchServiceTests : IDisposable
{
    private const double Latitude = 54.8972;
    private const double Longitude = 23.8861;
    private const int RadiusKm = 30;

    private static readonly IReadOnlyList<string> Tags = ["tourism=museum"];

    private static readonly MapElement Museum = new(
        "node/1", Latitude, Longitude, new Dictionary<string, string> { ["name"] = "Museum", ["tourism"] = "museum" });

    private readonly RecordingMapPlacesClient client = new() { Answer = [Museum] };
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T12:05:00Z"));
    private readonly CapturingLoggerProvider logs = new();
    private readonly ILoggerFactory loggerFactory;
    private readonly ForecastPeriod period;

    public MapPlacesSearchServiceTests()
    {
        loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(logs));
        period = new ForecastPeriod(clock);
    }

    public void Dispose() => loggerFactory.Dispose();

    [Fact]
    public async Task MainAnswers_FallbackIsNotCalled()
    {
        var elements = await FindAsync(WithFallback());

        Assert.Equal([Museum], elements);
        var call = Assert.Single(client.Calls);
        Assert.Equal(MapDataServerRole.Main, call.Server.Role);
        Assert.Equal(new Uri("https://main.test/"), call.Server.Address);
    }

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task MainFails_FallbackAnswers(FailureKind kind)
    {
        client.Fail(MapDataServerRole.Main, kind);

        var elements = await FindAsync(WithFallback());

        Assert.Equal([Museum], elements);
        Assert.Equal(
            [MapDataServerRole.Main, MapDataServerRole.Fallback],
            client.Calls.Select(call => call.Server.Role));
        Assert.Equal(new Uri("https://fallback.test/"), client.Calls[1].Server.Address);
    }

    [Fact]
    public async Task EachAttempt_GetsItsServersWaitingTime()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Network);
        var options = new MapDataOptions
        {
            MainServer = "https://main.test/",
            MainTimeoutSeconds = 3,
            FallbackServer = "https://fallback.test/",
            FallbackTimeoutSeconds = 5
        };

        await FindAsync(options);

        Assert.Equal([TimeSpan.FromSeconds(3), TimeSpan.FromSeconds(5)], client.Calls.Select(call => call.Timeout));
    }

    [Fact]
    public async Task MainAnswersWithNoPlaces_IsASuccessAndFallbackIsNotCalled()
    {
        client.Answer = [];

        var elements = await FindAsync(WithFallback());

        Assert.Empty(elements);
        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task BothFail_TheFallbacksFailureIsThrown()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Timeout);
        client.Fail(MapDataServerRole.Fallback, FailureKind.UnexpectedStatus);

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(WithFallback()));

        Assert.Equal(ExternalService.MapData, failure.Service);
        Assert.Equal(FailureKind.UnexpectedStatus, failure.Kind);
        Assert.Equal(2, client.Calls.Count);
    }

    [Fact]
    public async Task NoFallbackConfigured_MainFailureIsThrownAtOnce()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Network);

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(
            () => FindAsync(new MapDataOptions { MainServer = "https://main.test/" }));

        Assert.Equal(FailureKind.Network, failure.Kind);
        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task CancelledRequest_IsNotSentToTheFallback()
    {
        client.OnCall = _ => throw new OperationCanceledException();

        await Assert.ThrowsAsync<OperationCanceledException>(() => FindAsync(WithFallback()));

        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task OtherException_IsNotSentToTheFallback()
    {
        client.OnCall = _ => throw new InvalidOperationException("Not a map data failure.");

        await Assert.ThrowsAsync<InvalidOperationException>(() => FindAsync(WithFallback()));

        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task OtherServicesFailure_IsNotSentToTheFallback()
    {
        client.OnCall = _ => throw new ExternalServiceException(ExternalService.Forecast, FailureKind.Timeout);

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(WithFallback()));

        Assert.Equal(ExternalService.Forecast, failure.Service);
        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task Search_PassesThePositionRadiusAndTagsToEachServer()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Timeout);

        await FindAsync(WithFallback());

        Assert.All(client.Calls, call =>
        {
            Assert.Equal(Latitude, call.Latitude);
            Assert.Equal(Longitude, call.Longitude);
            Assert.Equal(RadiusKm, call.RadiusKm);
            Assert.Equal(Tags, call.Tags);
        });
    }

    // --- the deadline (User Story 3) ---

    [Fact]
    public async Task AttemptTime_IsTheServersWaitingTimeWhenEnoughTimeIsLeft()
    {
        await FindAsync(WithFallback());

        Assert.Equal(TimeSpan.FromSeconds(6), Assert.Single(client.Calls).Timeout);
    }

    [Fact]
    public async Task MainFailsQuickly_FallbackGetsItsFullTime()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Network);
        MoveClockOnMainCall(TimeSpan.FromSeconds(0.3));

        await FindAsync(WithFallback());

        Assert.Equal([TimeSpan.FromSeconds(6), TimeSpan.FromSeconds(6)], client.Calls.Select(call => call.Timeout));
    }

    [Fact]
    public async Task MainUsesItsTime_FallbackGetsOnlyWhatIsLeft()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Timeout);
        MoveClockOnMainCall(TimeSpan.FromSeconds(6));

        await FindAsync(WithFallback());

        Assert.Equal([TimeSpan.FromSeconds(6), TimeSpan.FromSeconds(3)], client.Calls.Select(call => call.Timeout));
    }

    [Fact]
    public async Task LessThanOneSecondLeft_FallbackIsNotContactedAndAWarningIsLogged()
    {
        client.Fail(MapDataServerRole.Main, FailureKind.Timeout);
        MoveClockOnMainCall(TimeSpan.FromSeconds(8.5));

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(WithFallback()));

        Assert.Equal(FailureKind.Timeout, failure.Kind);
        Assert.Equal(MapDataServerRole.Main, Assert.Single(client.Calls).Server.Role);
        var warning = Assert.Single(logs.Entries, entry => entry.Contains("not contacted"));
        Assert.Contains("Warning", warning);
        Assert.Contains("Map data service not contacted: no time left for the fallback server", warning);
        Assert.DoesNotContain("fallback.test", warning);
    }

    [Fact]
    public async Task NoTimeLeftAtStart_NoServerIsContactedAndTheFailureIsATimeout()
    {
        var deadline = RequestDeadline.Start(period);
        clock.UtcNow += TimeSpan.FromSeconds(8.5);

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(WithFallback(), deadline));

        Assert.Equal(ExternalService.MapData, failure.Service);
        Assert.Equal(FailureKind.Timeout, failure.Kind);
        Assert.Empty(client.Calls);
        Assert.Contains(logs.Entries, entry => entry.Contains("no time left for the main server"));
        Assert.DoesNotContain(logs.Entries, entry => entry.Contains("no time left for the fallback server"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(2)]
    [InlineData(5)]
    [InlineData(7.5)]
    public async Task AttemptTime_IsCappedAtNineSecondsInTotal(double secondsAlreadyUsed)
    {
        // Both servers stay silent for as long as they are given, at the longest allowed waiting time.
        var deadline = RequestDeadline.Start(period);
        clock.UtcNow += TimeSpan.FromSeconds(secondsAlreadyUsed);
        client.Fail(MapDataServerRole.Main, FailureKind.Timeout);
        client.Fail(MapDataServerRole.Fallback, FailureKind.Timeout);
        client.OnCall = _ => clock.UtcNow += client.Calls[^1].Timeout;
        var options = new MapDataOptions
        {
            MainServer = "https://main.test/",
            MainTimeoutSeconds = MapDataOptions.LongestTimeoutSeconds,
            FallbackServer = "https://fallback.test/",
            FallbackTimeoutSeconds = MapDataOptions.LongestTimeoutSeconds
        };

        await Assert.ThrowsAsync<ExternalServiceException>(() => FindAsync(options, deadline));

        var total = TimeSpan.FromSeconds(secondsAlreadyUsed) + client.Calls.Aggregate(
            TimeSpan.Zero, (sum, call) => sum + call.Timeout);
        Assert.True(total <= RequestDeadline.Limit, $"The request would take {total}.");
        Assert.All(client.Calls, call => Assert.True(call.Timeout >= RequestDeadline.ShortestAttempt));
    }

    // --- helpers ---

    private static MapDataOptions WithFallback() =>
        new() { MainServer = "https://main.test/", FallbackServer = "https://fallback.test/" };

    // As if the main server took this long to answer or fail.
    private void MoveClockOnMainCall(TimeSpan time) =>
        client.OnCall = server =>
        {
            if (server.Role == MapDataServerRole.Main)
            {
                clock.UtcNow += time;
            }
        };

    private Task<IReadOnlyList<MapElement>> FindAsync(MapDataOptions options, RequestDeadline? deadline = null) =>
        new MapPlacesSearchService(
                client,
                Options.Create(options),
                loggerFactory.CreateLogger<MapPlacesSearchService>())
            .FindAsync(
                Latitude,
                Longitude,
                RadiusKm,
                Tags,
                deadline ?? RequestDeadline.Start(period),
                CancellationToken.None);
}
