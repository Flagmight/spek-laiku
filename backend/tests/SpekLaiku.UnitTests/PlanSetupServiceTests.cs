using Microsoft.Extensions.Caching.Memory;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan setup check on Continue (spec FR-012, FR-015): the rules plus the location lookup.</summary>
public sealed class PlanSetupServiceTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 11, 4);

    private static readonly GeocodingPlace Kaunas =
        new(598316, "Kaunas", 54.90156, 23.90909, "LT", "Kaunas", "Kaunas");

    private readonly RecordingGeocodingClient client = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly PlanSetupService service;

    public PlanSetupServiceTests()
    {
        var clock = new FixedTimeProvider(DateTimeOffset.Parse("2026-11-04T10:00:00Z"));
        service = new PlanSetupService(new LocationSearchService(client, cache), new ForecastPeriod(clock));
    }

    [Fact]
    public async Task ValidSetup_UsesTheServicesPlaceSortedDatesAndTheDefaultDistance()
    {
        client.ScriptPlace(Kaunas);

        var result = await service.CheckAsync(
            new PlanSetupCheckRequest(598316, [Today.AddDays(4), Today.AddDays(3)], null),
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(new PlaceLocation(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909), result.Setup.Location);
        Assert.Equal([Today.AddDays(3), Today.AddDays(4)], result.Setup.Dates);
        Assert.Equal(30, result.Setup.MaxTravelDistanceKm);
    }

    [Fact]
    public async Task UnknownPlace_IsTheFirstErrorBeforeTheValidatorsErrors()
    {
        var result = await service.CheckAsync(
            new PlanSetupCheckRequest(42, [Today.AddDays(-1)], 0m),
            CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(
            [
                Error("locationId", "Select a location in Lithuania from the list."),
                Error("dates[0]", "Dates cannot be in the past."),
                Error("maxTravelDistanceKm", "Enter a whole number between 1 and 200.")
            ],
            result.Errors);
    }

    [Fact]
    public async Task PlaceOutsideLithuania_IsRefused()
    {
        client.ScriptPlace(new GeocodingPlace(456172, "Riga", 56.946, 24.10589, "LV", "Riga", null));

        var result = await service.CheckAsync(
            new PlanSetupCheckRequest(456172, [Today], null),
            CancellationToken.None);

        Assert.Equal([Error("locationId", "Select a location in Lithuania from the list.")], result.Errors);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0L)]
    [InlineData(-3L)]
    public async Task MissingOrNonPositiveId_IsRefusedWithoutAskingTheService(long? locationId)
    {
        var result = await service.CheckAsync(
            new PlanSetupCheckRequest(locationId, [Today], null),
            CancellationToken.None);

        Assert.Equal([Error("locationId", "Select a location in Lithuania from the list.")], result.Errors);
        Assert.Empty(client.GetIds);
    }

    [Fact]
    public async Task ServiceFailure_IsRethrown()
    {
        client.Failure = new ExternalServiceException(ExternalService.LocationSearch, FailureKind.Timeout);

        await Assert.ThrowsAsync<ExternalServiceException>(() => service.CheckAsync(
            new PlanSetupCheckRequest(598316, [Today], null),
            CancellationToken.None));
    }

    public void Dispose() => cache.Dispose();

    private static KeyValuePair<string, string> Error(string key, string message) => new(key, message);
}
