using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The plan schedule to the response objects in contracts/plan-schedule-api.md. The whole assembly's profiles
/// are loaded, as in the API, because the "HH:mm" conversion lives in <see cref="PlanForecastMappingProfile"/>.
/// </summary>
public sealed class PlanScheduleMappingTests : IDisposable
{
    private static readonly Guid CategoryId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");

    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanScheduleMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanScheduleMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void PlanSchedule_MapsEveryField()
    {
        var place = new NearbyPlace("Slipway", 54.89, 23.93, 3.4m, "Kaunas", "node/1");
        var schedule = new PlanSchedule(
            Scheduled:
            [
                new ScheduledActivity(
                    CategoryId,
                    "Kayaking",
                    new DateOnly(2026, 11, 14),
                    new TimeOnly(10, 0),
                    new TimeOnly(12, 0),
                    place,
                    new WeatherSnapshot(18.5m, 0.2m, 3.1m, IsIndoor: false))
            ],
            Unscheduled:
            [
                new UnscheduledActivity("Museum", UnscheduledReason.NoPlace),
                new UnscheduledActivity("Cycling", UnscheduledReason.NoSuitableTime)
            ],
            Travel: new TravelSummary(30, 0));

        var response = mapper.Map<PlanScheduleResponse>(schedule);

        Assert.Single(response.Scheduled);
        var item = response.Scheduled[0];
        Assert.Equal("Kayaking", item.ActivityName);
        Assert.Equal(new DateOnly(2026, 11, 14), item.Date);
        Assert.Equal("10:00", item.StartTime);
        Assert.Equal("12:00", item.EndTime);
        Assert.Equal(new NearbyPlaceResponse("Slipway", 54.89, 23.93, 3.4m, "Kaunas"), item.Place);
        Assert.Equal(18.5m, item.Weather.TemperatureC);
        Assert.Equal(0.2m, item.Weather.RainMmPerHour);
        Assert.Equal(3.1m, item.Weather.WindMs);
        Assert.False(item.Weather.IsIndoor);
        Assert.Null(item.Travel);

        Assert.Equal(2, response.Unscheduled.Count);
        Assert.Equal("Museum", response.Unscheduled[0].ActivityName);
        Assert.Equal("noPlace", response.Unscheduled[0].Reason);
        Assert.Equal("Cycling", response.Unscheduled[1].ActivityName);
        Assert.Equal("noSuitableTime", response.Unscheduled[1].Reason);
    }

    [Fact]
    public void IndoorActivity_WeatherNullsAndIsIndoorTrue()
    {
        var place = new NearbyPlace("Muziejus", 54.9, 23.9, 1.0m, null, "node/2");
        var schedule = new PlanSchedule(
            Scheduled:
            [
                new ScheduledActivity(
                    CategoryId,
                    "Museum",
                    new DateOnly(2026, 11, 14),
                    new TimeOnly(9, 0),
                    new TimeOnly(11, 0),
                    place,
                    new WeatherSnapshot(null, null, null, IsIndoor: true))
            ],
            Unscheduled: [],
            Travel: new TravelSummary(30, 0));

        var response = mapper.Map<PlanScheduleResponse>(schedule);

        var weather = response.Scheduled[0].Weather;
        Assert.True(weather.IsIndoor);
        Assert.Null(weather.TemperatureC);
        Assert.Null(weather.RainMmPerHour);
        Assert.Null(weather.WindMs);
    }

    [Fact]
    public void ScheduledActivityResponse_HasTheExpectedPropertyNames()
    {
        Assert.Equal(
            ["ActivityName", "Date", "StartTime", "EndTime", "Place", "Weather", "Travel"],
            typeof(ScheduledActivityResponse).GetProperties().Select(property => property.Name));
    }

    [Fact]
    public void PlanScheduleResponse_HasTheExpectedPropertyNames()
    {
        // ScheduledActivity.CategoryId is internal to the server (feature 009 research section 6).
        Assert.Equal(
            ["Scheduled", "Unscheduled", "Travel"],
            typeof(PlanScheduleResponse).GetProperties().Select(property => property.Name));
    }

    [Fact]
    public void TravelLegAndSummary_MapEveryField()
    {
        var place = new NearbyPlace("Picnic area", 54.9, 23.9, 1.0m, null, "node/3");
        var schedule = new PlanSchedule(
            Scheduled:
            [
                new ScheduledActivity(
                    CategoryId,
                    "Picnic",
                    new DateOnly(2026, 11, 14),
                    new TimeOnly(12, 0),
                    new TimeOnly(16, 0),
                    place,
                    new WeatherSnapshot(11m, 0m, 4m, IsIndoor: false),
                    new TravelLeg("Place A", 4.2m, OverLimit: false)),
                new ScheduledActivity(
                    CategoryId,
                    "Cycling",
                    new DateOnly(2026, 11, 14),
                    new TimeOnly(17, 0),
                    new TimeOnly(19, 0),
                    place,
                    new WeatherSnapshot(9m, 0m, 3m, IsIndoor: false),
                    new TravelLeg("Picnic area", 42.0m, OverLimit: true))
            ],
            Unscheduled: [],
            Travel: new TravelSummary(30, 2));

        var response = mapper.Map<PlanScheduleResponse>(schedule);

        Assert.Equal(new TravelLegResponse("Place A", 4.2m, false), response.Scheduled[0].Travel);
        Assert.Equal(new TravelLegResponse("Picnic area", 42.0m, true), response.Scheduled[1].Travel);
        Assert.Equal(new TravelSummaryResponse(30, 2), response.Travel);
    }

    public void Dispose() => provider.Dispose();
}
