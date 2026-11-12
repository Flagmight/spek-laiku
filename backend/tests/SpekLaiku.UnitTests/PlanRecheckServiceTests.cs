using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.DTOs.Requests;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The check every step 3 request starts with (research section 2): the setup, then the activities, with
/// the keys and order both the forecast and the place requests answer with.
/// </summary>
public sealed class PlanRecheckServiceTests : IDisposable
{
    private static readonly DateOnly Today = new(2026, 11, 10);
    private static readonly GeocodingPlace Kaunas = new(598316, "Kaunas", 54.8972, 23.8861, "LT", "Kaunas", null);

    // 14:05 in Vilnius (UTC+2).
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T12:05:00Z"));
    private readonly RecordingGeocodingClient geocoding = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly ApplicationDbContext context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private readonly ActivityCategory kayaking = Category("Kayaking", ActivityType.Outdoor);
    private readonly ActivityCategory museum = Category("Museum", ActivityType.Indoor);

    public PlanRecheckServiceTests()
    {
        geocoding.ScriptPlace(Kaunas);
        context.ActivityCategories.AddRange(kayaking, museum);
        context.SaveChanges();
    }

    [Fact]
    public async Task ValidPlan_GivesTheCheckedSetupAndActivitiesInRequestOrder()
    {
        var result = await CreateService().CheckAsync(
            new PlanSetupCheckRequest(Kaunas.Id, [Today.AddDays(1), Today], 20m),
            [Museum(), Kayaking()],
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Empty(result.Errors);
        Assert.Equal(Kaunas.Id, result.Setup.Location.Id);
        Assert.Equal(54.8972, result.Setup.Location.Latitude);
        Assert.Equal([Today, Today.AddDays(1)], result.Setup.Dates);
        Assert.Equal(20, result.Setup.MaxTravelDistanceKm);
        Assert.Equal(["Museum", "Kayaking"], result.Activities.Select(activity => activity.Name));
        Assert.Equal([museum.Id, kayaking.Id], result.Activities.Select(activity => activity.CategoryId));
    }

    [Fact]
    public async Task MissingSetup_GivesOnlyTheSetupKeyAndAsksNoService()
    {
        var result = await CreateService().CheckAsync(null, [Kayaking()], CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal([Error("setup", "The request is invalid.")], result.Errors);
        Assert.Empty(geocoding.GetIds);
    }

    [Fact]
    public async Task InvalidSetup_GivesThePrefixedKeysInTheSetupChecksOrderAndChecksNoActivity()
    {
        // A disposed context throws if anything queries it, so the activity check must not run.
        var disposed = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        await disposed.DisposeAsync();

        var result = await CreateService(disposed).CheckAsync(
            new PlanSetupCheckRequest(42, [Today.AddDays(-1)], 0m),
            [Kayaking()],
            CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(
            [
                Error("setup.locationId", "Select a location in Lithuania from the list."),
                Error("setup.dates[0]", "Dates cannot be in the past."),
                Error("setup.maxTravelDistanceKm", "Enter a whole number between 1 and 200.")
            ],
            result.Errors);
    }

    [Fact]
    public async Task InvalidActivities_GiveTheActivityKeysUnchanged()
    {
        var tooWindy = Kayaking() with { MaxWindMs = 31m };
        var unknown = Kayaking() with { CategoryId = Guid.NewGuid() };

        var result = await CreateService().CheckAsync(
            new PlanSetupCheckRequest(Kaunas.Id, [Today], null),
            [tooWindy, unknown],
            CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal(
            [
                Error("activities[0].maxWindMs", "Enter a wind limit between 0 and 30 m/s."),
                Error("activities[1]", PlanActivityValidator.UnavailableMessage)
            ],
            result.Errors);
        Assert.Null(result.Setup);
    }

    [Fact]
    public async Task NoActivities_GivesTheListKey()
    {
        var result = await CreateService().CheckAsync(
            new PlanSetupCheckRequest(Kaunas.Id, [Today], null),
            null,
            CancellationToken.None);

        Assert.Equal([Error("activities", PlanActivityValidator.NoActivitiesMessage)], result.Errors);
    }

    public void Dispose()
    {
        cache.Dispose();
        context.Dispose();
    }

    private static KeyValuePair<string, string> Error(string key, string message) => new(key, message);

    private static ActivityCategory Category(string name, ActivityType type) => new()
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
        MaxTemperatureC = type == ActivityType.Outdoor ? 35m : null
    };

    private PlanActivityRequest Kayaking() => new(kayaking.Id, "Outdoor", 2m, true, 8m, 0.5m, 15m, 35m);

    private PlanActivityRequest Museum() => new(museum.Id, "Indoor", 1.5m, false, null, null, null, null);

    private PlanRecheckService CreateService(ApplicationDbContext? activities = null)
    {
        var database = activities ?? context;
        return new PlanRecheckService(
            new PlanSetupService(new LocationSearchService(geocoding, cache), new ForecastPeriod(clock)),
            new PlanActivityService(database, new ActivityCategoryService(database)));
    }
}
