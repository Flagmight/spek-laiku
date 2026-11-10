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
/// The forecast for a plan (spec FR-003 to FR-005, research section 8): the setup and activities checked
/// again with the feature 004 and 005 services, then the forecast judged for each activity.
/// </summary>
public sealed class PlanForecastServiceTests : IDisposable
{
    private static readonly TimeZoneInfo Lithuania = TimeZoneInfo.FindSystemTimeZoneById("Europe/Vilnius");
    private static readonly DateOnly Today = new(2026, 11, 10);
    private static readonly GeocodingPlace Vilnius = new(593116, "Vilnius", 54.6872, 25.2797, "LT", "Vilnius", null);

    // 14:05 in Vilnius (UTC+2).
    private readonly FixedTimeProvider clock = new(DateTimeOffset.Parse("2026-11-10T12:05:00Z"));
    private readonly RecordingGeocodingClient geocoding = new();
    private readonly RecordingForecastClient forecastClient = new();
    private readonly MemoryCache cache = new(new MemoryCacheOptions());
    private readonly ApplicationDbContext context = new(new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .Options);

    private readonly ActivityCategory kayaking = new()
    {
        Id = Guid.NewGuid(),
        Name = "Kayaking",
        NormalizedName = "KAYAKING",
        Type = ActivityType.Outdoor,
        DefaultDurationHours = 2m,
        RequiresDaylight = true,
        MaxWindMs = 8m,
        MaxRainMmPerHour = 0.5m,
        MinTemperatureC = 15m,
        MaxTemperatureC = 35m
    };

    public PlanForecastServiceTests()
    {
        geocoding.ScriptPlace(Vilnius);
        // 18 °C everywhere, no rain, 3 m/s; daylight 07:46 to 16:15.
        forecastClient.Answer = Forecast(Today, 7, 18.0);
        context.ActivityCategories.Add(kayaking);
        context.SaveChanges();
    }

    [Fact]
    public async Task GetAsync_GivesOneDayPerPlanDateAndOneForecastPerActivityInRequestOrder()
    {
        var tomorrow = Today.AddDays(1);
        var cold = new PlanActivityRequest(kayaking.Id, "Outdoor", 2m, true, 8m, 0.5m, 20m, 35m);

        var result = await CreateService().GetAsync(
            new PlanForecastRequest(
                new PlanSetupCheckRequest(Vilnius.Id, [tomorrow, Today], null),
                [Kayaking(), cold]),
            CancellationToken.None);

        Assert.True(result.Succeeded);
        Assert.Equal([Today, tomorrow], result.Forecast.Days.Select(day => day.Date));
        // Today at 14:05: the hours from 15:00 are left.
        Assert.Equal(new TimeOnly(15, 0), result.Forecast.Days[0].Hours[0].Start);
        Assert.Equal(16, result.Forecast.Days[1].Hours.Count);
        Assert.Equal(2, result.Forecast.Activities.Count);
        // Tomorrow in daylight 08:00 to 16:00: 8 suitable hours for the first, none for the one needing 20 °C.
        Assert.Equal(8, result.Forecast.Activities[0].Days[1].Hours.Count(hour => hour.Suitable));
        Assert.Equal(0, result.Forecast.Activities[1].SuitableHours);
    }

    [Fact]
    public async Task GetAsync_UsesThePositionFromTheLocationServiceForTheWholePeriod()
    {
        await CreateService().GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(Vilnius.Id, [Today], null), [Kayaking()]),
            CancellationToken.None);

        Assert.Equal([Vilnius.Id], geocoding.GetIds);
        Assert.Equal((54.6872, 25.2797, Today, Today.AddDays(6)), Assert.Single(forecastClient.Calls));
    }

    [Fact]
    public async Task GetAsync_UpdatedAtIsTheReceivedTimeInLithuaniaToTheMinute()
    {
        var result = await CreateService().GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(Vilnius.Id, [Today], null), [Kayaking()]),
            CancellationToken.None);

        Assert.Equal(new TimeOnly(14, 5), result.Forecast!.UpdatedAt);
    }

    [Fact]
    public async Task MissingSetup_GivesOnlyTheSetupKey()
    {
        var result = await CreateService().GetAsync(new PlanForecastRequest(null, [Kayaking()]), CancellationToken.None);

        Assert.False(result.Succeeded);
        Assert.Equal([Error("setup", "The request is invalid.")], result.Errors);
        Assert.Empty(forecastClient.Calls);
    }

    [Fact]
    public async Task PastDate_GivesThePrefixedSetupKeyAndChecksNothingElse()
    {
        // A disposed context throws if anything queries it, so the activity check must not run.
        var disposed = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        await disposed.DisposeAsync();

        var result = await CreateService(disposed).GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(Vilnius.Id, [Today.AddDays(-1)], null), [Kayaking()]),
            CancellationToken.None);

        Assert.Equal([Error("setup.dates[0]", "Dates cannot be in the past.")], result.Errors);
        Assert.Empty(forecastClient.Calls);
    }

    [Fact]
    public async Task UnknownLocationAndBadDistance_KeepTheSetupChecksOrder()
    {
        var result = await CreateService().GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(42, [Today], 0m), [Kayaking()]),
            CancellationToken.None);

        Assert.Equal(
            [
                Error("setup.locationId", "Select a location in Lithuania from the list."),
                Error("setup.maxTravelDistanceKm", "Enter a whole number between 1 and 200.")
            ],
            result.Errors);
        Assert.Empty(forecastClient.Calls);
    }

    [Fact]
    public async Task InvalidActivities_GiveTheActivityKeysWithoutAskingForTheForecast()
    {
        var tooWindy = Kayaking() with { MaxWindMs = 31m };
        var unknown = Kayaking() with { CategoryId = Guid.NewGuid() };

        var result = await CreateService().GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(Vilnius.Id, [Today], null), [tooWindy, unknown]),
            CancellationToken.None);

        Assert.Equal(
            [
                Error("activities[0].maxWindMs", "Enter a wind limit between 0 and 30 m/s."),
                Error("activities[1]", PlanActivityValidator.UnavailableMessage)
            ],
            result.Errors);
        Assert.Empty(forecastClient.Calls);
    }

    [Fact]
    public async Task NoActivities_GivesTheListKey()
    {
        var result = await CreateService().GetAsync(
            new PlanForecastRequest(new PlanSetupCheckRequest(Vilnius.Id, [Today], null), []),
            CancellationToken.None);

        Assert.Equal([Error("activities", PlanActivityValidator.NoActivitiesMessage)], result.Errors);
        Assert.Empty(forecastClient.Calls);
    }

    public void Dispose()
    {
        cache.Dispose();
        context.Dispose();
    }

    private static KeyValuePair<string, string> Error(string key, string message) => new(key, message);

    private PlanActivityRequest Kayaking() => new(kayaking.Id, "Outdoor", 2m, true, 8m, 0.5m, 15m, 35m);

    private PlanForecastService CreateService(ApplicationDbContext? activities = null)
    {
        var period = new ForecastPeriod(clock);
        var options = Options.Create(new ForecastOptions());
        var database = activities ?? context;
        return new PlanForecastService(
            new PlanSetupService(new LocationSearchService(geocoding, cache), period),
            new PlanActivityService(database, new ActivityCategoryService(database)),
            new WeatherForecastService(forecastClient, cache, period, options),
            period,
            options);
    }

    private static HourlyForecast Forecast(DateOnly firstDate, int days, double temperature)
    {
        var start = Local(firstDate, TimeOnly.MinValue);
        var hours = Enumerable.Range(0, (days + 1) * 24)
            .Select(hour => new ForecastHourValues(start.AddHours(hour), temperature, 0.0, 3.0))
            .ToList();
        var daylight = Enumerable.Range(0, days)
            .Select(offset => firstDate.AddDays(offset))
            .Select(date => new ForecastDaylight(date, Local(date, new TimeOnly(7, 46)), Local(date, new TimeOnly(16, 15))))
            .ToList();
        return new HourlyForecast(hours, daylight);
    }

    private static DateTimeOffset Local(DateOnly date, TimeOnly time)
    {
        var local = date.ToDateTime(time);
        return new DateTimeOffset(local, Lithuania.GetUtcOffset(local));
    }
}
