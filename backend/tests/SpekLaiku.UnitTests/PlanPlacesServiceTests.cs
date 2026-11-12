using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The places for a plan (spec FR-004 to FR-007, FR-012; data-model.md PlanPlacesService): the plan checked
/// again, the tags from the database, the capped radius and the oldest receive time.
/// </summary>
public sealed class PlanPlacesServiceTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 11, 10);
    private static readonly GeocodingPlace Kaunas = new(598316, "Kaunas", 54.8972, 23.8861, "LT", "Kaunas", null);

    // 09:00 in Vilnius (UTC+2).
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T07:00:00Z"));
    private readonly RecordingGeocodingClient geocoding = new();
    private readonly RecordingMapPlacesClient mapPlaces = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly ApplicationDbContext context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private readonly ActivityCategory kayaking = Category("Kayaking", ActivityType.Outdoor, "leisure=slipway", "sport=canoe");
    private readonly ActivityCategory museum = Category("Museum", ActivityType.Indoor, "tourism=museum");

    public PlanPlacesServiceTests()
    {
        geocoding.ScriptPlace(Kaunas);
        context.ActivityCategories.AddRange(kayaking, museum);
        context.SaveChanges();
        mapPlaces.Answer =
        [
            new MapElement("node/1", 54.9, 23.89, Tags(("name", "Nemuno slipway"), ("leisure", "slipway"))),
            new MapElement("node/2", 54.91, 23.9, Tags(("name", "Kauno pilies muziejus"), ("tourism", "museum")))
        ];
    }

    [Fact]
    public async Task Categories_HaveOneEntryPerDistinctCategoryInOrderOfFirstAppearance()
    {
        var result = await GetAsync(30m, Kayaking(), Museum(), Kayaking());

        Assert.True(result.Succeeded);
        Assert.Equal([kayaking.Id, museum.Id], result.Places.Categories.Select(category => category.CategoryId));
        Assert.Equal(["Nemuno slipway"], Names(result.Places.Categories[0]));
        Assert.Equal(["Kauno pilies muziejus"], Names(result.Places.Categories[1]));
    }

    [Fact]
    public async Task Search_UsesTheTagsFromTheDatabaseAndThePositionFromTheLocationService()
    {
        await GetAsync(30m, Kayaking(), Museum());

        var call = Assert.Single(mapPlaces.Calls);
        Assert.Equal(["leisure=slipway", "sport=canoe", "tourism=museum"], call.Tags);
        Assert.Equal(Kaunas.Latitude, call.Latitude);
        Assert.Equal(Kaunas.Longitude, call.Longitude);
        Assert.Equal([Kaunas.Id], geocoding.GetIds);
    }

    [Theory]
    [InlineData(10, 10)]
    [InlineData(50, 50)]
    [InlineData(80, 50)]
    public async Task Radius_IsTheMaximumTravelDistanceCappedAt50Km(int maxTravelDistanceKm, int radiusKm)
    {
        var result = await GetAsync(maxTravelDistanceKm, Kayaking());

        Assert.Equal(radiusKm, result.Places!.RadiusKm);
        Assert.Equal(radiusKm, Assert.Single(mapPlaces.Calls).RadiusKm);
    }

    [Fact]
    public async Task UpdatedAt_IsTheOldestReceivedTimeInLithuaniaToTheMinute()
    {
        await GetAsync(30m, Kayaking());
        // 10:30:45 in Vilnius: the museum is received now, the kayaking places at 09:00 are reused.
        clock.UtcNow = DateTimeOffset.Parse("2026-11-10T08:30:45Z");

        var result = await GetAsync(30m, Kayaking(), Museum());

        Assert.Equal(new TimeOnly(9, 0), result.Places!.UpdatedAt);
        Assert.Equal(["tourism=museum"], mapPlaces.Calls[1].Tags);
    }

    [Fact]
    public async Task UpdatedAt_IsNowWhenEverythingIsNew()
    {
        clock.UtcNow = DateTimeOffset.Parse("2026-11-10T08:30:45Z");

        var result = await GetAsync(30m, Kayaking());

        Assert.Equal(new TimeOnly(10, 30), result.Places!.UpdatedAt);
    }

    public void Dispose()
    {
        cache.Dispose();
        context.Dispose();
    }

    private static List<string> Names(CategoryPlaces category) => category.Places.Select(place => place.Name).ToList();

    private static Dictionary<string, string> Tags(params (string Key, string Value)[] tags) =>
        tags.ToDictionary(tag => tag.Key, tag => tag.Value);

    private static ActivityCategory Category(string name, ActivityType type, params string[] placeTags) => new()
    {
        Id = Guid.NewGuid(),
        Name = name,
        NormalizedName = name.ToUpperInvariant(),
        Type = type,
        DefaultDurationHours = 2m,
        RequiresDaylight = type == ActivityType.Outdoor,
        MaxWindMs = type == ActivityType.Outdoor ? 8m : null,
        MaxRainMmPerHour = type == ActivityType.Outdoor ? 0.5m : null,
        MinTemperatureC = type == ActivityType.Outdoor ? 15m : null,
        MaxTemperatureC = type == ActivityType.Outdoor ? 35m : null,
        PlaceTags = [.. placeTags]
    };

    private PlanActivityRequest Kayaking() => new(kayaking.Id, "Outdoor", 2m, true, 8m, 0.5m, 15m, 35m);

    private PlanActivityRequest Museum() => new(museum.Id, "Indoor", 1.5m, false, null, null, null, null);

    private Task<PlanPlacesResult> GetAsync(decimal maxTravelDistanceKm, params PlanActivityRequest[] activities) =>
        CreateService().GetAsync(
            new PlanPlacesRequest(new PlanSetupCheckRequest(Kaunas.Id, [Today], maxTravelDistanceKm), [.. activities]),
            CancellationToken.None);

    private PlanPlacesService CreateService()
    {
        var period = new ForecastPeriod(clock);
        var options = Options.Create(new PlacesOptions());
        return new PlanPlacesService(
            new PlanRecheckService(
                new PlanSetupService(new LocationSearchService(geocoding, cache), period),
                new PlanActivityService(context, new ActivityCategoryService(context))),
            context,
            new NearbyPlacesService(mapPlaces, cache, period, options),
            options);
    }
}
