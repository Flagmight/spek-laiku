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

    public void Dispose()
    {
        cache.Dispose();
        context.Dispose();
    }

    private PlanActivityRequest Kayaking() => new(kayaking.Id, "Outdoor", 2m, true, 8m, 0.5m, 15m, 35m);

    private PlanForecastService CreateService()
    {
        var period = new ForecastPeriod(clock);
        var options = Options.Create(new ForecastOptions());
        return new PlanForecastService(
            new PlanSetupService(new LocationSearchService(geocoding, cache), period),
            new PlanActivityService(context, new ActivityCategoryService(context)),
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
