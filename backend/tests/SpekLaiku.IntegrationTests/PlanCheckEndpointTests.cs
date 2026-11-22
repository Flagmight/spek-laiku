using System.Net;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>GET /api/plans/{id}/check</c> for the plan's owner (feature 012 spec User Stories 1 and 2, contracts/
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
