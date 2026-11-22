using System.Text.Json;
using AutoMapper;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Mapping;
using SpekLaiku.Api.Services;

namespace SpekLaiku.UnitTests;

/// <summary>
/// The plan check to the response in feature 012 contracts/plan-check-api.md. The whole assembly's profiles are
/// loaded, as in the API, because the "HH:mm" format and the weather map live in other profiles.
/// </summary>
public sealed class PlanCheckMappingTests : IDisposable
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    private readonly ServiceProvider provider;
    private readonly IMapper mapper;

    public PlanCheckMappingTests()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddAutoMapper(_ => { }, typeof(PlanCheckMappingProfile).Assembly);
        provider = services.BuildServiceProvider();
        mapper = provider.GetRequiredService<IMapper>();
    }

    [Fact]
    public void Configuration_IsValid()
    {
        mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void Check_MapsToTheContractShape()
    {
        var check = new PlanCheck(
            new DateTime(2026, 11, 18, 12, 5, 0, DateTimeKind.Utc),
            AllPast: false,
            new TimeOnly(14, 5),
            [
                new PlanCheckEntry(
                    new DateOnly(2026, 11, 20), new TimeOnly(9, 0), new TimeOnly(11, 0), "Museum", true, null, []),
                new PlanCheckEntry(
                    new DateOnly(2026, 11, 21),
                    new TimeOnly(10, 0),
                    new TimeOnly(12, 0),
                    "Kayaking",
                    false,
                    new WeatherSnapshot(6.5m, 0.0m, 7.2m, IsIndoor: false),
                    [
                        new PlanProblem(PlanRule.Wind, Time: new TimeOnly(11, 0), Value: 9.0m, Limit: 8.0m),
                        new PlanProblem(PlanRule.Travel, Value: 34.2m, Limit: 30m, FromPlaceName: "Kaunas Castle")
                    ])
            ]);

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(mapper.Map<PlanCheckResponse>(check), Web));
        var root = json.RootElement;

        Assert.Equal(["savedAt", "status", "forecastUpdatedAt", "entries"], Keys(root));
        Assert.Equal("2026-11-18T12:05:00+00:00", root.GetProperty("savedAt").GetString());
        Assert.Equal("checked", root.GetProperty("status").GetString());
        Assert.Equal("14:05", root.GetProperty("forecastUpdatedAt").GetString());

        var past = root.GetProperty("entries")[0];
        Assert.Equal(
            ["date", "startTime", "endTime", "activityName", "past", "weather", "problems"],
            Keys(past));
        Assert.Equal("2026-11-20", past.GetProperty("date").GetString());
        Assert.Equal("09:00", past.GetProperty("startTime").GetString());
        Assert.True(past.GetProperty("past").GetBoolean());
        Assert.Equal(JsonValueKind.Null, past.GetProperty("weather").ValueKind);

        var kayaking = root.GetProperty("entries")[1];
        Assert.Equal(7.2m, kayaking.GetProperty("weather").GetProperty("windMs").GetDecimal());
        var wind = kayaking.GetProperty("problems")[0];
        Assert.Equal(
            ["rule", "time", "value", "limit", "sunTime", "otherActivityName", "otherStartTime", "otherEndTime", "fromPlaceName"],
            Keys(wind));
        Assert.Equal("wind", wind.GetProperty("rule").GetString());
        Assert.Equal("11:00", wind.GetProperty("time").GetString());
        Assert.Equal(9.0m, wind.GetProperty("value").GetDecimal());
        Assert.Equal(8.0m, wind.GetProperty("limit").GetDecimal());
        Assert.Equal(JsonValueKind.Null, wind.GetProperty("fromPlaceName").ValueKind);

        var travel = kayaking.GetProperty("problems")[1];
        Assert.Equal("travel", travel.GetProperty("rule").GetString());
        Assert.Equal(JsonValueKind.Null, travel.GetProperty("time").ValueKind);
        Assert.Equal("Kaunas Castle", travel.GetProperty("fromPlaceName").GetString());
    }

    [Theory]
    [InlineData(PlanRule.Wind, "wind")]
    [InlineData(PlanRule.Rain, "rain")]
    [InlineData(PlanRule.Cold, "cold")]
    [InlineData(PlanRule.Heat, "heat")]
    [InlineData(PlanRule.NoForecast, "noForecast")]
    [InlineData(PlanRule.BeforeSunrise, "beforeSunrise")]
    [InlineData(PlanRule.AfterSunset, "afterSunset")]
    [InlineData(PlanRule.Overlap, "overlap")]
    [InlineData(PlanRule.Travel, "travel")]
    public void Rules_AreCamelCase(PlanRule rule, string expected)
    {
        Assert.Equal(expected, mapper.Map<PlanProblemResponse>(new PlanProblem(rule)).Rule);
    }

    [Fact]
    public void Overlap_MapsTheOtherActivityAndItsTimes()
    {
        var response = mapper.Map<PlanProblemResponse>(new PlanProblem(
            PlanRule.Overlap, OtherActivityName: "Museum", OtherStartTime: new TimeOnly(9, 0), OtherEndTime: new TimeOnly(11, 30)));

        Assert.Equal("Museum", response.OtherActivityName);
        Assert.Equal("09:00", response.OtherStartTime);
        Assert.Equal("11:30", response.OtherEndTime);
    }

    [Fact]
    public void NullTimes_StayNull()
    {
        var response = mapper.Map<PlanProblemResponse>(new PlanProblem(PlanRule.Overlap));

        Assert.Null(response.Time);
        Assert.Null(response.SunTime);
        Assert.Null(response.OtherStartTime);
        Assert.Null(response.OtherEndTime);
    }

    [Fact]
    public void AllPast_MapsToStatusAllPastWithNoForecastTime()
    {
        var check = new PlanCheck(DateTime.UtcNow, AllPast: true, ForecastUpdatedAt: null, []);

        var response = mapper.Map<PlanCheckResponse>(check);

        Assert.Equal("allPast", response.Status);
        Assert.Null(response.ForecastUpdatedAt);
    }

    [Fact]
    public void CategoryIdAndActivityIndex_AreNeverSent()
    {
        Assert.DoesNotContain(
            typeof(PlanCheckEntryResponse).GetProperties(),
            property => property.Name is "CategoryId" or "ActivityIndex");
        Assert.DoesNotContain(
            typeof(PlanCheckResponse).GetProperties(),
            property => property.Name is "CategoryId" or "ActivityIndex" or "OwnerId");
    }

    public void Dispose() => provider.Dispose();

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();
}
