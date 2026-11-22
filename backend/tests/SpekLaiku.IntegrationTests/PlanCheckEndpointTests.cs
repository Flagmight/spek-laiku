using System.Globalization;
using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Data;
using SpekLaiku.Api.Entities;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plans/{id}/check</c> for the plan's owner (feature 012 spec User Stories 1, 2, 3 and 5, contracts/
/// plan-check-api.md), against real PostgreSQL, a fixed clock and a scripted weather service. Each test seeds its
/// own plan at its own location, so forecasts are never shared between tests.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public sealed class PlanCheckEndpointTests : IDisposable
{
    private static readonly Guid KayakingId = Guid.Parse("12000000-0000-4000-8000-000000000001");
    private static readonly Guid MuseumId = Guid.Parse("12000000-0000-4000-8000-000000000002");

    private static readonly CheckedPlanActivity Kayaking = SavedPlanSeed.Outdoor("Kayaking", KayakingId, maxWind: 8);
    private static readonly CheckedPlanActivity Museum = SavedPlanSeed.Indoor("Museum", MuseumId);

    private readonly PostgreSqlApiFactory factory;
    private readonly SavedPlanSeed seed;
    private readonly DateTimeOffset clockBefore;

    public PlanCheckEndpointTests(PostgreSqlApiFactory factory)
    {
        this.factory = factory;
        seed = new SavedPlanSeed(factory);
        clockBefore = factory.Clock.UtcNow;
        factory.Clock.UtcNow = ScheduleScenario.Now;
    }

    public void Dispose() => factory.Clock.UtcNow = clockBefore;

    [Fact]
    public async Task WindAboveTheLimit_IsListedOnTheEntry()
    {
        // The spec's User Story 1 test: Kayaking (wind up to 8 m/s) 10:00–12:00, 9 m/s at 11:00.
        var (client, location, id) = await KayakingPlanAsync();
        Script(location, FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), SavedPlanSeed.PlanDate, 11, 10.0, 0.0, 9.0));

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
        var problem = Assert.Single(Entry(body, 0).GetProperty("problems").EnumerateArray());
        Assert.Equal("wind", problem.GetProperty("rule").GetString());
        Assert.Equal("11:00", problem.GetProperty("time").GetString());
        Assert.Equal(9.0m, problem.GetProperty("value").GetDecimal());
        Assert.Equal(8.0m, problem.GetProperty("limit").GetDecimal());
    }

    [Fact]
    public async Task ForecastWithinLimits_HasNoProblems()
    {
        var (client, location, id) = await KayakingPlanAsync();
        Script(location, SavedPlanSeed.CalmForecast());

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
        Assert.Empty(Entry(body, 0).GetProperty("problems").EnumerateArray());
    }

    [Fact]
    public async Task Body_MatchesTheContract()
    {
        var (client, location, id) = await KayakingPlanAsync();
        Script(location, SavedPlanSeed.CalmForecast());

        var (_, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(["savedAt", "status", "forecastUpdatedAt", "entries"], Keys(body));
        Assert.Equal(
            new DateTimeOffset(SavedPlanSeed.SavedAtUtc),
            body.GetProperty("savedAt").GetDateTimeOffset());
        // The clock is 14:20 in Vilnius when the forecast is received.
        Assert.Equal("14:20", body.GetProperty("forecastUpdatedAt").GetString());

        var entry = Entry(body, 0);
        Assert.Equal(["date", "startTime", "endTime", "activityName", "past", "weather", "problems"], Keys(entry));
        Assert.Equal("2026-11-12", entry.GetProperty("date").GetString());
        Assert.Equal("10:00", entry.GetProperty("startTime").GetString());
        Assert.Equal("12:00", entry.GetProperty("endTime").GetString());
        Assert.Equal("Kayaking", entry.GetProperty("activityName").GetString());
        Assert.False(entry.GetProperty("past").GetBoolean());
        Assert.Equal(["temperatureC", "rainMmPerHour", "windMs", "isIndoor"], Keys(entry.GetProperty("weather")));
    }

    [Fact]
    public async Task Entries_FollowTheOrderOfTheSavedSchedule()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.PlanDate, SavedPlanSeed.PlanDate.AddDays(1)],
            [Kayaking, Museum],
            [
                SavedPlanSeed.Entry(1, Museum, SavedPlanSeed.PlanDate, new TimeOnly(8, 0), new TimeOnly(10, 0)),
                SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(11, 0), new TimeOnly(13, 0)),
                SavedPlanSeed.Entry(1, Museum, SavedPlanSeed.PlanDate.AddDays(1), new TimeOnly(9, 0), new TimeOnly(11, 0))
            ]);
        Script(location, SavedPlanSeed.CalmForecast());

        var (_, check) = await SavedPlanSeed.CheckAsync(client, id);
        var plan = await GetPlanAsync(client, id);

        Assert.Equal(
            plan.GetProperty("scheduled").EnumerateArray().Select(EntryKey),
            check.GetProperty("entries").EnumerateArray().Select(EntryKey));
    }

    [Fact]
    public async Task LatestWeather_IsReturnedForEachEntry()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.PlanDate],
            [Kayaking, Museum],
            [
                SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0)),
                SavedPlanSeed.Entry(1, Museum, SavedPlanSeed.PlanDate, new TimeOnly(13, 0), new TimeOnly(15, 0))
            ]);
        Script(location, FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), SavedPlanSeed.PlanDate, 10, 6.5, 0.2, 7.2));

        var (_, body) = await SavedPlanSeed.CheckAsync(client, id);

        var kayaking = Entry(body, 0).GetProperty("weather");
        Assert.Equal(6.5m, kayaking.GetProperty("temperatureC").GetDecimal());
        Assert.Equal(0.2m, kayaking.GetProperty("rainMmPerHour").GetDecimal());
        Assert.Equal(7.2m, kayaking.GetProperty("windMs").GetDecimal());
        Assert.False(kayaking.GetProperty("isIndoor").GetBoolean());
        var museum = Entry(body, 1).GetProperty("weather");
        Assert.True(museum.GetProperty("isIndoor").GetBoolean());
        Assert.Equal(JsonValueKind.Null, museum.GetProperty("windMs").ValueKind);
    }

    [Fact]
    public async Task SecondCheckWithin30Minutes_ReusesTheForecast()
    {
        var (client, location, id) = await KayakingPlanAsync();
        Script(location, SavedPlanSeed.CalmForecast());
        var calls = factory.Forecast.Calls;

        var (_, first) = await SavedPlanSeed.CheckAsync(client, id);
        factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(29);
        var (_, second) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(calls + 1, factory.Forecast.Calls);
        Assert.Equal("14:20", first.GetProperty("forecastUpdatedAt").GetString());
        // The time the forecast was received, not the time of the check (spec Edge Cases).
        Assert.Equal("14:20", second.GetProperty("forecastUpdatedAt").GetString());
    }

    [Fact]
    public async Task CheckAfter30Minutes_AsksAgainAndSeesTheNewForecast()
    {
        // The spec's User Story 2 test: rain above the limit appears after the first check.
        var (client, location, id) = await KayakingPlanAsync();
        Script(location, SavedPlanSeed.CalmForecast());
        var (_, first) = await SavedPlanSeed.CheckAsync(client, id);
        Assert.Empty(Entry(first, 0).GetProperty("problems").EnumerateArray());

        Script(location, FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), SavedPlanSeed.PlanDate, 10, 10.0, 2.5, 5.0));
        factory.Clock.UtcNow = ScheduleScenario.Now.AddMinutes(31);
        var calls = factory.Forecast.Calls;
        var (_, second) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(calls + 1, factory.Forecast.Calls);
        Assert.Equal("14:51", second.GetProperty("forecastUpdatedAt").GetString());
        var problem = Assert.Single(Entry(second, 0).GetProperty("problems").EnumerateArray());
        Assert.Equal("rain", problem.GetProperty("rule").GetString());
        Assert.Equal("10:00", problem.GetProperty("time").GetString());
        Assert.Equal(2.5m, problem.GetProperty("value").GetDecimal());
        Assert.Equal(1.0m, problem.GetProperty("limit").GetDecimal());
    }

    /// <summary>
    /// One seeded plan per rule, through the real endpoint (spec SC-002, User Story 3). Kayaking (wind up to 8 m/s,
    /// rain up to 1 mm/h, 0 to 30 °C, daylight required) is at 10:00–12:00; each scenario breaks exactly one rule on
    /// the entry it names, and the problem's fields are those of the contract table.
    /// </summary>
    [Theory]
    [InlineData("wind")]
    [InlineData("rain")]
    [InlineData("cold")]
    [InlineData("heat")]
    [InlineData("noForecast")]
    [InlineData("beforeSunrise")]
    [InlineData("afterSunset")]
    [InlineData("overlap")]
    [InlineData("travel")]
    public async Task RuleScenarios(string rule)
    {
        var scenario = RuleScenario.For(rule);
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(user.Id, location, [SavedPlanSeed.PlanDate], [Kayaking, Museum], scenario.Entries);
        Script(location, scenario.Forecast);

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        var problem = Assert.Single(Entry(body, scenario.EntryIndex).GetProperty("problems").EnumerateArray());
        Assert.Equal(scenario.Expected, ProblemFields(problem));
    }

    [Fact]
    public async Task CategoryLimitsChangedAfterSaving_TheSavedLimitsApply()
    {
        // The spec's Edge Case: the plan keeps the limits it was saved with.
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var categoryId = await FirstOutdoorCategoryIdAsync();
        var cycling = SavedPlanSeed.Outdoor("Cycling", categoryId, maxWind: 8);
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.PlanDate],
            [cycling],
            [SavedPlanSeed.Entry(0, cycling, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))]);
        Script(location, SavedPlanSeed.CalmForecast(wind: 5.0));

        var windBefore = await SetCategoryMaxWindAsync(categoryId, 2m);
        try
        {
            var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

            Assert.Equal(HttpStatusCode.OK, status);
            Assert.Empty(Entry(body, 0).GetProperty("problems").EnumerateArray());
        }
        finally
        {
            await SetCategoryMaxWindAsync(categoryId, windBefore);
        }
    }

    private async Task<Guid> FirstOutdoorCategoryIdAsync()
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await context.ActivityCategories.AsNoTracking()
            .Where(category => category.Type == ActivityType.Outdoor)
            .OrderBy(category => category.NormalizedName)
            .Select(category => category.Id)
            .FirstAsync();
    }

    /// <summary>Sets the category's own wind limit and returns the value it had.</summary>
    private async Task<decimal?> SetCategoryMaxWindAsync(Guid categoryId, decimal? maxWind)
    {
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var category = await context.ActivityCategories.SingleAsync(saved => saved.Id == categoryId);
        var before = category.MaxWindMs;
        category.MaxWindMs = maxWind;
        await context.SaveChangesAsync();
        return before;
    }

    /// <summary>The nine problem fields as text, <c>null</c> where the rule does not use the field.</summary>
    private static List<string?> ProblemFields(JsonElement problem) =>
        new[] { "rule", "time", "value", "limit", "sunTime", "otherActivityName", "otherStartTime", "otherEndTime", "fromPlaceName" }
            .Select(name => problem.GetProperty(name) switch
            {
                { ValueKind: JsonValueKind.Null } => null,
                { ValueKind: JsonValueKind.Number } number => number.GetDecimal().ToString("0.0#", CultureInfo.InvariantCulture),
                var text => text.GetString()
            })
            .ToList();

    /// <summary>A plan that breaks one rule: its schedule, the scripted forecast and the expected problem fields.</summary>
    private sealed record RuleScenario(
        IReadOnlyList<ScheduledActivity> Entries,
        HourlyForecast Forecast,
        int EntryIndex,
        List<string?> Expected)
    {
        private static readonly DateOnly Date = SavedPlanSeed.PlanDate;

        public static RuleScenario For(string rule) => rule switch
        {
            "wind" => WeatherHour(11, 10.0, 0.0, 9.0, ["wind", "11:00", "9.0", "8.0", null, null, null, null, null]),
            "rain" => WeatherHour(10, 10.0, 2.5, 5.0, ["rain", "10:00", "2.5", "1.0", null, null, null, null, null]),
            "cold" => WeatherHour(10, -3.0, 0.0, 5.0, ["cold", "10:00", "-3.0", "0.0", null, null, null, null, null]),
            "heat" => WeatherHour(11, 33.0, 0.0, 5.0, ["heat", "11:00", "33.0", "30.0", null, null, null, null, null]),
            "noForecast" => WeatherHour(11, null, null, null, ["noForecast", "11:00", null, null, null, null, null, null, null]),
            "beforeSunrise" => new(
                [Kayaking10To12()],
                Daylight(new TimeOnly(10, 30), SavedPlanSeed.Sunset),
                0,
                ["beforeSunrise", "10:00", null, null, "10:30", null, null, null, null]),
            "afterSunset" => new(
                [Kayaking10To12()],
                Daylight(SavedPlanSeed.Sunrise, new TimeOnly(11, 30)),
                0,
                ["afterSunset", "12:00", null, null, "11:30", null, null, null, null]),
            "overlap" => new(
                [Kayaking10To12(), SavedPlanSeed.Entry(1, Museum, Date, new TimeOnly(11, 0), new TimeOnly(13, 0))],
                SavedPlanSeed.CalmForecast(),
                0,
                ["overlap", null, null, null, null, "Museum", "11:00", "13:00", null]),
            "travel" => new(
                [
                    SavedPlanSeed.Entry(1, Museum, Date, new TimeOnly(8, 0), new TimeOnly(10, 0)),
                    Kayaking10To12() with { Travel = new TravelLeg("Museum place", 34.2m, OverLimit: true) }
                ],
                SavedPlanSeed.CalmForecast(),
                1,
                ["travel", null, "34.2", "30.0", null, null, null, null, "Museum place"]),
            _ => throw new ArgumentOutOfRangeException(nameof(rule), rule, "No scenario for this rule.")
        };

        private static RuleScenario WeatherHour(int hour, double? temperature, double? rain, double? wind, List<string?> expected) =>
            new(
                [Kayaking10To12()],
                FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), Date, hour, temperature, rain, wind),
                0,
                expected);

        private static HourlyForecast Daylight(TimeOnly sunrise, TimeOnly sunset) =>
            FakeForecastClient.Fill(SavedPlanSeed.Today, ForecastPeriod.Days, 10.0, 0.0, 5.0, sunrise, sunset);

        private static ScheduledActivity Kayaking10To12() =>
            SavedPlanSeed.Entry(0, Kayaking, Date, new TimeOnly(10, 0), new TimeOnly(12, 0));
    }

    [Fact]
    public async Task PartlyPastPlan_ChecksOnlyTheActivitiesAhead()
    {
        // The spec's User Story 5 test: the clock is on 2026-11-10; one entry the day before, one two days after.
        var yesterday = SavedPlanSeed.Today.AddDays(-1);
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [yesterday, SavedPlanSeed.PlanDate],
            [Kayaking],
            [
                SavedPlanSeed.Entry(0, Kayaking, yesterday, new TimeOnly(10, 0), new TimeOnly(12, 0)),
                SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))
            ]);
        Script(location, FakeForecastClient.WithHour(SavedPlanSeed.CalmForecast(), SavedPlanSeed.PlanDate, 11, 10.0, 0.0, 9.0));

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
        var past = Entry(body, 0);
        Assert.True(past.GetProperty("past").GetBoolean());
        Assert.Equal(JsonValueKind.Null, past.GetProperty("weather").ValueKind);
        Assert.Empty(past.GetProperty("problems").EnumerateArray());
        var ahead = Entry(body, 1);
        Assert.False(ahead.GetProperty("past").GetBoolean());
        Assert.Equal("wind", Assert.Single(ahead.GetProperty("problems").EnumerateArray()).GetProperty("rule").GetString());
    }

    [Fact]
    public async Task PlanWithEveryActivityStarted_IsAllPastAndCallsNoWeatherService()
    {
        var yesterday = SavedPlanSeed.Today.AddDays(-1);
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [yesterday],
            [Kayaking, Museum],
            [
                SavedPlanSeed.Entry(0, Kayaking, yesterday, new TimeOnly(10, 0), new TimeOnly(12, 0)),
                SavedPlanSeed.Entry(1, Museum, yesterday, new TimeOnly(13, 0), new TimeOnly(15, 0))
            ]);
        Script(location, SavedPlanSeed.CalmForecast());
        var calls = factory.Forecast.Calls;

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("allPast", body.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, body.GetProperty("forecastUpdatedAt").ValueKind);
        Assert.Equal(2, body.GetProperty("entries").GetArrayLength());
        Assert.All(body.GetProperty("entries").EnumerateArray(), entry =>
        {
            Assert.True(entry.GetProperty("past").GetBoolean());
            Assert.Equal(JsonValueKind.Null, entry.GetProperty("weather").ValueKind);
            Assert.Empty(entry.GetProperty("problems").EnumerateArray());
        });
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task ActivityThatStartedButHasNotEnded_IsPast()
    {
        // 14:20 in Vilnius: Kayaking 14:00–16:00 today has started; the Museum later today has not.
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.Today],
            [Kayaking, Museum],
            [
                SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.Today, new TimeOnly(14, 0), new TimeOnly(16, 0)),
                SavedPlanSeed.Entry(1, Museum, SavedPlanSeed.Today, new TimeOnly(17, 0), new TimeOnly(19, 0))
            ]);
        Script(location, SavedPlanSeed.CalmForecast());

        var (status, body) = await SavedPlanSeed.CheckAsync(client, id);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("checked", body.GetProperty("status").GetString());
        Assert.True(Entry(body, 0).GetProperty("past").GetBoolean());
        Assert.False(Entry(body, 1).GetProperty("past").GetBoolean());
    }

    private async Task<(HttpClient Client, PlaceLocation Location, Guid Id)> KayakingPlanAsync()
    {
        var (user, client) = await factory.CreateSignedInUserAsync();
        var location = SavedPlanSeed.NewLocation();
        var id = await seed.InsertAsync(
            user.Id,
            location,
            [SavedPlanSeed.PlanDate],
            [Kayaking],
            [SavedPlanSeed.Entry(0, Kayaking, SavedPlanSeed.PlanDate, new TimeOnly(10, 0), new TimeOnly(12, 0))]);
        return (client, location, id);
    }

    private void Script(PlaceLocation location, HourlyForecast forecast) =>
        factory.Forecast.Script(location.Latitude, location.Longitude, forecast);

    private static async Task<JsonElement> GetPlanAsync(HttpClient client, Guid id)
    {
        using var response = await client.GetAsync($"/api/plans/{id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    private static JsonElement Entry(JsonElement body, int index) => body.GetProperty("entries")[index];

    private static string EntryKey(JsonElement entry) =>
        $"{entry.GetProperty("date").GetString()} {entry.GetProperty("startTime").GetString()} " +
        entry.GetProperty("activityName").GetString();

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();
}
