using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>The plan forecast to the response objects in contracts/plan-forecast-api.md.</summary>
public sealed class PlanForecastMappingTests : IDisposable
{
    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanForecastMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanForecastMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void Times_AreWrittenAsHoursAndMinutes()
    {
        Assert.Equal("07:05", mapper.Map<string>(new TimeOnly(7, 5, 59)));
        Assert.Equal("22:00", mapper.Map<string>(new TimeOnly(22, 0)));
    }

    [Fact]
    public void PlanForecast_MapsEveryField()
    {
        var date = new DateOnly(2026, 11, 14);
        var forecast = new PlanForecast(
            new TimeOnly(14, 5),
            [
                new PlanningDay(
                    date,
                    new TimeOnly(7, 46),
                    new TimeOnly(16, 15),
                    [
                        new PlanningHour(new TimeOnly(12, 0), new TimeOnly(13, 0), 16.4m, 1.2m, 9.0m, true),
                        new PlanningHour(new TimeOnly(21, 0), new TimeOnly(22, 0), null, null, null, false)
                    ]),
                new PlanningDay(date.AddDays(1), new TimeOnly(7, 48), new TimeOnly(16, 13), [])
            ],
            [
                new ActivityForecast(
                    false,
                    3,
                    1,
                    true,
                    [
                        new ActivityDayForecast(
                            date,
                            [new SuitablePeriod(new TimeOnly(13, 0), new TimeOnly(15, 0), 2, false)],
                            new SuitablePeriod(new TimeOnly(13, 0), new TimeOnly(15, 0), 2, false),
                            [
                                new HourSuitability(new TimeOnly(12, 0), ["Too windy: 9.0 m/s, maximum 8.0 m/s"]),
                                new HourSuitability(new TimeOnly(13, 0), [])
                            ])
                    ])
            ]);

        var response = mapper.Map<PlanForecastResponse>(forecast);

        Assert.Equal("14:05", response.UpdatedAt);
        Assert.Equal(2, response.Days.Count);
        Assert.Equal(date, response.Days[0].Date);
        Assert.Equal("07:46", response.Days[0].Sunrise);
        Assert.Equal("16:15", response.Days[0].Sunset);
        Assert.Equal(new ForecastHourResponse("12:00", "13:00", 16.4m, 1.2m, 9.0m, true), response.Days[0].Hours[0]);
        Assert.Equal(new ForecastHourResponse("21:00", "22:00", null, null, null, false), response.Days[0].Hours[1]);
        Assert.Empty(response.Days[1].Hours);

        var activity = Assert.Single(response.Activities);
        Assert.False(activity.WeatherIndependent);
        Assert.Equal(3, activity.SuitableHours);
        Assert.Equal(1, activity.DatesWithSuitableHours);
        Assert.True(activity.HasLongEnoughPeriod);
        var day = Assert.Single(activity.Days);
        Assert.Equal(date, day.Date);
        Assert.Equal(new SuitablePeriodResponse("13:00", "15:00", 2, false), Assert.Single(day.Periods));
        Assert.Equal(new SuitablePeriodResponse("13:00", "15:00", 2, false), day.LongestPeriod);
        Assert.Equal("12:00", day.Hours[0].Start);
        Assert.False(day.Hours[0].Suitable);
        Assert.Equal(["Too windy: 9.0 m/s, maximum 8.0 m/s"], day.Hours[0].Reasons);
        Assert.True(day.Hours[1].Suitable);
        Assert.Empty(day.Hours[1].Reasons);
    }

    [Fact]
    public void DayWithoutPeriods_HasNoLongestPeriod()
    {
        var day = new ActivityDayForecast(new DateOnly(2026, 11, 14), [], null, []);

        Assert.Null(mapper.Map<ActivityDayForecastResponse>(day).LongestPeriod);
    }

    public void Dispose() => provider.Dispose();
}
