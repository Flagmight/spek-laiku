using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The places of each category around a location (spec FR-005, FR-012; research sections 4 and 5): one call
/// for every category that needs one, reuse for up to 24 hours, and no reuse of failures.
/// </summary>
public sealed class NearbyPlacesServiceTests : IDisposable
{
    private const int RadiusKm = 30;

    // 1 km due north of the location, on the sphere GeoDistance uses.
    private const double OneKmInDegrees = 180 / (GeoDistance.EarthRadiusKm * Math.PI);

    private static readonly PlaceLocation Kaunas = new(598316, "Kaunas", "Kauno m.", 54.8972, 23.8861);
    private static readonly CategoryTags Kayaking = new(Guid.NewGuid(), ["leisure=slipway", "sport=canoe"]);
    private static readonly CategoryTags Canoeing = new(Guid.NewGuid(), ["sport=canoe", "tourism=museum"]);
    private static readonly CategoryTags Museum = new(Guid.NewGuid(), ["tourism=museum"]);

    // 14:05 in Vilnius (UTC+2).
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T12:05:00Z"));
    private readonly RecordingMapPlacesClient client = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());

    public NearbyPlacesServiceTests()
    {
        client.Answer =
        [
            Element("node/1", 1, "Slipway", ("leisure", "slipway")),
            Element("node/2", 2, "Canoe club", ("sport", "canoe")),
            Element("node/3", 3, "Museum", ("tourism", "museum"))
        ];
    }

    [Fact]
    public async Task UncachedCategories_AreSearchedInOneCallAndEachGetsOnlyItsOwnMatches()
    {
        var received = await GetAsync(Kayaking, Canoeing);

        var call = Assert.Single(client.Calls);
        Assert.Equal(Kaunas.Latitude, call.Latitude);
        Assert.Equal(Kaunas.Longitude, call.Longitude);
        Assert.Equal(RadiusKm, call.RadiusKm);
        Assert.Equal(["leisure=slipway", "sport=canoe", "tourism=museum"], call.Tags);
        Assert.Equal(["Slipway", "Canoe club"], Names(received[0]));
        Assert.Equal(["Canoe club", "Museum"], Names(received[1]));
    }

    [Fact]
    public async Task ReceivedTime_IsNowInLithuania()
    {
        var received = await GetAsync(Kayaking);

        Assert.Equal(DateTimeOffset.Parse("2026-11-10T14:05:00+02:00"), received[0].ReceivedAt);
    }

    [Fact]
    public async Task CachedCategory_IsReusedForJustUnder24HoursWithItsReceivedTime()
    {
        var first = await GetAsync(Kayaking);
        clock.UtcNow = clock.UtcNow.AddHours(24).AddMinutes(-1);

        var second = await GetAsync(Kayaking);

        Assert.Single(client.Calls);
        Assert.Equal(first[0].ReceivedAt, second[0].ReceivedAt);
        Assert.Equal(Names(first[0]), Names(second[0]));
    }

    [Fact]
    public async Task CachedCategory_IsAskedForAgainAfter24Hours()
    {
        await GetAsync(Kayaking);
        clock.UtcNow = clock.UtcNow.AddHours(24);

        var again = await GetAsync(Kayaking);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(DateTimeOffset.Parse("2026-11-11T14:05:00+02:00"), again[0].ReceivedAt);
    }

    [Fact]
    public async Task PartlyCachedPlan_AsksOnlyForTheNewCategorysTags()
    {
        await GetAsync(Kayaking);

        var received = await GetAsync(Kayaking, Museum);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(["tourism=museum"], client.Calls[1].Tags);
        Assert.Equal(["Slipway", "Canoe club"], Names(received[0]));
        Assert.Equal(["Museum"], Names(received[1]));
    }

    [Fact]
    public async Task SameTagsInAnotherOrder_ShareOneEntry()
    {
        await GetAsync(Kayaking);

        await GetAsync(new CategoryTags(Guid.NewGuid(), ["sport=canoe", "leisure=slipway"]));

        Assert.Single(client.Calls);
    }

    [Fact]
    public async Task AnotherRadius_IsAskedForAgain()
    {
        await GetAsync(Kayaking);

        await CreateService().GetAsync(Kaunas, 10, [Kayaking], CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(10, client.Calls[1].RadiusKm);
    }

    [Fact]
    public async Task AnotherLocation_IsAskedForAgain()
    {
        await GetAsync(Kayaking);

        await CreateService().GetAsync(Kaunas with { Id = 1 }, RadiusKm, [Kayaking], CancellationToken.None);

        Assert.Equal(2, client.Calls.Count);
    }

    [Fact]
    public async Task ChangedTags_AreAskedForAgain()
    {
        await GetAsync(Kayaking);

        await GetAsync(Kayaking with { Tags = ["leisure=slipway"] });

        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(["leisure=slipway"], client.Calls[1].Tags);
    }

    [Fact]
    public async Task CategoryWithoutTags_GetsNoPlacesWithoutACall()
    {
        var received = await GetAsync(new CategoryTags(Guid.NewGuid(), []));

        Assert.Empty(received[0].Places);
        Assert.Empty(client.Calls);
    }

    [Fact]
    public async Task Failure_PassesThroughAndIsNotCached()
    {
        client.Fail(FailureKind.Timeout);

        var failure = await Assert.ThrowsAsync<ExternalServiceException>(() => GetAsync(Kayaking));
        client.Failure = null;
        var received = await GetAsync(Kayaking);

        Assert.Equal(ExternalService.MapData, failure.Service);
        Assert.Equal(2, client.Calls.Count);
        Assert.Equal(["Slipway", "Canoe club"], Names(received[0]));
    }

    [Fact]
    public async Task Failure_FailsTheWholeRequestButKeepsEarlierEntries()
    {
        await GetAsync(Kayaking);
        client.Fail(FailureKind.Network);

        await Assert.ThrowsAsync<ExternalServiceException>(() => GetAsync(Kayaking, Museum));
        client.Failure = null;
        await GetAsync(Kayaking);

        // The failed call and nothing after it for the cached category.
        Assert.Equal(2, client.Calls.Count);
    }

    public void Dispose() => cache.Dispose();

    private static List<string> Names(ReceivedPlaces received) => received.Places.Select(place => place.Name).ToList();

    private static MapElement Element(string key, double kmNorth, string name, params (string Key, string Value)[] tags) =>
        new(
            key,
            Kaunas.Latitude + kmNorth * OneKmInDegrees,
            Kaunas.Longitude,
            tags.Append((Key: "name", Value: name)).ToDictionary(tag => tag.Key, tag => tag.Value));

    private Task<IReadOnlyList<ReceivedPlaces>> GetAsync(params CategoryTags[] categories) =>
        CreateService().GetAsync(Kaunas, RadiusKm, categories, CancellationToken.None);

    private NearbyPlacesService CreateService() =>
        new(client, cache, new ForecastPeriod(clock), Options.Create(new PlacesOptions()));
}
