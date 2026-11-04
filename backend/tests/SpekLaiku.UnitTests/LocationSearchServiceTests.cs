using Microsoft.Extensions.Caching.Memory;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>Location search and lookup rules (spec FR-004 to FR-006, research sections 1 to 5).</summary>
public sealed class LocationSearchServiceTests : IDisposable
{
    private static readonly GeocodingPlace Kaunas =
        new(598316, "Kaunas", 54.90156, 23.90909, "LT", "Kaunas", "Kaunas");

    private static readonly GeocodingPlace Kauniai =
        new(11301040, "Kauniai", 56.19924, 24.69617, "LT", "Panevėžys", "Biržai District Municipality");

    private static readonly GeocodingPlace Riga = new(456172, "Riga", 56.946, 24.10589, "LV", "Riga", null);

    private readonly RecordingGeocodingClient client = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly LocationSearchService service;

    public LocationSearchServiceTests()
    {
        service = new LocationSearchService(client, cache);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("a")]
    [InlineData("  a  ")]
    [InlineData("   ")]
    public async Task TooShortText_IsRefusedWithoutCallingTheService(string? query)
    {
        var result = await service.SearchAsync(query, CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal("Enter between 2 and 100 characters.", result.Errors["query"]);
        Assert.Empty(client.SearchTexts);
    }

    [Fact]
    public async Task TextLongerThan100Characters_IsRefused()
    {
        var result = await service.SearchAsync(new string('a', 101), CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal("Enter between 2 and 100 characters.", result.Errors["query"]);
        Assert.Empty(client.SearchTexts);
    }

    [Fact]
    public async Task TextOf100Characters_IsSearched()
    {
        var result = await service.SearchAsync(new string('a', 100), CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Single(client.SearchTexts);
    }

    [Fact]
    public async Task Places_AreMappedWithTheirAreaAndOnlyLithuaniaIsKept()
    {
        client.Script("Kaun", Kaunas, Riga, Kauniai);

        var result = await service.SearchAsync("Kaun", CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal(
            [
                new PlaceLocation(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909),
                new PlaceLocation(11301040, "Kauniai", "Biržai District Municipality", 56.19924, 24.69617)
            ],
            result.Locations);
    }

    [Fact]
    public async Task CountryCodeInLowerCase_StillCountsAsLithuania()
    {
        client.Script("Kaun", Kaunas with { CountryCode = "lt" });

        var result = await service.SearchAsync("Kaun", CancellationToken.None);

        Assert.Single(result.Locations!);
    }

    [Fact]
    public async Task AtMostTenPlaces_AreReturnedInTheServicesOrder()
    {
        var places = Enumerable.Range(1, 12)
            .Select(id => new GeocodingPlace(id, $"Place {id}", 55, 24, "LT", "Vilnius", null))
            .ToArray();
        client.Script("Place", places);

        var result = await service.SearchAsync("Place", CancellationToken.None);

        Assert.Equal(Enumerable.Range(1, 10).Select(id => (long)id), result.Locations!.Select(place => place.Id));
    }

    [Fact]
    public async Task SameTextInOtherCaseOrWithSpaces_IsAnsweredFromTheCache()
    {
        client.Script("Kaunas", Kaunas);

        await service.SearchAsync("Kaunas", CancellationToken.None);
        var second = await service.SearchAsync("  KAUNAS ", CancellationToken.None);

        Assert.Single(client.SearchTexts);
        Assert.Single(second.Locations!);
    }

    [Fact]
    public async Task TextAfterAComma_IsNotSearched()
    {
        client.Script("Kaunas", Kaunas);

        var result = await service.SearchAsync("Kaunas, Kaunas Count", CancellationToken.None);

        Assert.Equal(["Kaunas"], client.SearchTexts);
        Assert.Single(result.Locations!);
    }

    [Theory]
    [InlineData(", abc")]
    [InlineData("K, Kaunas")]
    public async Task FewerThanTwoCharactersBeforeTheComma_GiveNoPlacesWithoutCallingTheService(string query)
    {
        var result = await service.SearchAsync(query, CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Empty(result.Locations!);
        Assert.Empty(client.SearchTexts);
    }

    [Fact]
    public async Task ChosenPlaceTextAndItsName_ShareOneCacheEntry()
    {
        client.Script("Kaunas", Kaunas);

        await service.SearchAsync("Kaunas", CancellationToken.None);
        await service.SearchAsync("Kaunas, Kaunas County", CancellationToken.None);

        Assert.Single(client.SearchTexts);
    }

    [Fact]
    public async Task ServiceFailure_IsRethrownAndNotCached()
    {
        client.Failure = new ExternalServiceException(ExternalService.LocationSearch, FailureKind.Timeout);

        await Assert.ThrowsAsync<ExternalServiceException>(() => service.SearchAsync("Kaunas", CancellationToken.None));
        client.Failure = null;
        client.Script("Kaunas", Kaunas);
        var result = await service.SearchAsync("Kaunas", CancellationToken.None);

        Assert.Equal(2, client.SearchTexts.Count);
        Assert.Single(result.Locations!);
    }

    [Fact]
    public async Task FindAsync_UsesAPlaceCachedByAnEarlierSearch()
    {
        client.Script("Kaunas", Kaunas);
        await service.SearchAsync("Kaunas", CancellationToken.None);

        var place = await service.FindAsync(598316, CancellationToken.None);

        Assert.Equal(new PlaceLocation(598316, "Kaunas", "Kaunas County", 54.90156, 23.90909), place);
        Assert.Empty(client.GetIds);
    }

    [Fact]
    public async Task FindAsync_LooksUpAnUnsearchedPlaceOnceAndCachesIt()
    {
        client.ScriptPlace(Kauniai);

        var first = await service.FindAsync(11301040, CancellationToken.None);
        var second = await service.FindAsync(11301040, CancellationToken.None);

        Assert.Equal("Biržai District Municipality", first!.Area);
        Assert.Equal(first, second);
        Assert.Equal([11301040L], client.GetIds);
    }

    [Fact]
    public async Task FindAsync_UnknownId_ReturnsNull()
    {
        Assert.Null(await service.FindAsync(42, CancellationToken.None));
    }

    [Fact]
    public async Task FindAsync_PlaceOutsideLithuania_ReturnsNull()
    {
        client.ScriptPlace(Riga);

        Assert.Null(await service.FindAsync(Riga.Id, CancellationToken.None));
    }

    [Fact]
    public async Task FindAsync_ServiceFailure_IsRethrown()
    {
        client.Failure = new ExternalServiceException(ExternalService.LocationSearch, FailureKind.Network);

        await Assert.ThrowsAsync<ExternalServiceException>(() => service.FindAsync(1, CancellationToken.None));
    }

    public void Dispose() => cache.Dispose();
}
