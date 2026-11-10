using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Getting and reusing a location's forecast for up to 30 minutes (spec FR-009, research section 4).</summary>
public sealed class WeatherForecastServiceTests : IDisposable
{
    private static readonly PlaceLocation Vilnius = new(593116, "Vilnius", "Vilnius County", 54.6872, 25.2797);

    // 12:00 in Vilnius (UTC+2).
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T10:00:00Z"));
    private readonly RecordingForecastClient client = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly WeatherForecastService service;

    public WeatherForecastServiceTests()
    {
        service = new WeatherForecastService(
            client,
            cache,
            new ForecastPeriod(clock),
            Options.Create(new ForecastOptions()));
    }

    [Fact]
    public async Task GetAsync_AsksForThePositionOverTheWholeForecastPeriod()
    {
        var received = await service.GetAsync(Vilnius, CancellationToken.None);

        var call = Assert.Single(client.Calls);
        Assert.Equal((54.6872, 25.2797, new DateOnly(2026, 11, 10), new DateOnly(2026, 11, 16)), call);
        Assert.Same(client.Answer, received.Data);
        Assert.Equal(clock.UtcNow, received.ReceivedAt);
        Assert.Equal(TimeSpan.FromHours(2), received.ReceivedAt.Offset);
    }

    [Fact]
    public async Task GetAsync_Within30Minutes_ReusesTheAnswerAndItsTime()
    {
        var first = await service.GetAsync(Vilnius, CancellationToken.None);
        clock.UtcNow = clock.UtcNow.AddMinutes(29);

        var second = await service.GetAsync(Vilnius, CancellationToken.None);

        Assert.Single(client.Calls);
        Assert.Equal(first.ReceivedAt, second.ReceivedAt);
    }

    [Fact]
    public async Task GetAsync_After30Minutes_AsksAgain()
    {
        var first = await service.GetAsync(Vilnius, CancellationToken.None);
        clock.UtcNow = clock.UtcNow.AddMinutes(30);

        var second = await service.GetAsync(Vilnius, CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(first.ReceivedAt.AddMinutes(30), second.ReceivedAt);
    }

    [Fact]
    public async Task GetAsync_TheNextDay_AsksForTheNewPeriod()
    {
        await service.GetAsync(Vilnius, CancellationToken.None);
        // 00:10 the next day in Vilnius, only 12 h 10 min later.
        clock.UtcNow = DateTimeOffset.Parse("2026-11-10T22:10:00Z");

        await service.GetAsync(Vilnius, CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(new DateOnly(2026, 11, 11), client.Calls[1].FirstDate);
    }

    [Fact]
    public async Task GetAsync_AnotherLocation_AsksAgain()
    {
        await service.GetAsync(Vilnius, CancellationToken.None);

        await service.GetAsync(new PlaceLocation(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909), CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(54.90156, client.Calls[1].Latitude);
    }

    [Fact]
    public async Task GetAsync_Failure_IsNotCached()
    {
        client.Failure = new ExternalServiceException(ExternalService.Forecast, FailureKind.Timeout);
        await Assert.ThrowsAsync<ExternalServiceException>(() => service.GetAsync(Vilnius, CancellationToken.None));
        client.Failure = null;

        await service.GetAsync(Vilnius, CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
    }

    public void Dispose() => cache.Dispose();
}
