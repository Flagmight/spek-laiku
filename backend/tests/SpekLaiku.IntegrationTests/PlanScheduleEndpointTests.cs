using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-schedule</c> as a Visitor (contracts/plan-schedule-api.md), against the fake location,
/// weather and map data services. Both caches are keyed by location, so every test scripts its own place id
/// and position, and adds its own categories.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanScheduleEndpointTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-schedule";

    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Fact]
    public async Task ValidPlan_ReturnsTheContractBody()
    {
        var place = ScriptPlaceWithForecastAndPlaces();
        var kayakingId = await AddOutdoorCategoryAsync("Schedule kayaking");

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[] { OutdoorActivity(kayakingId) }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(["generatedScheduleId", "scheduled", "unscheduled", "travel"], Keys(body));
        // Something was scheduled, so the schedule is remembered for saving (feature 010 contracts).
        Assert.True(Guid.TryParse(body.GetProperty("generatedScheduleId").GetString(), out _));

        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Single(scheduled);
        var item = scheduled[0];
        Assert.Equal(["activityName", "date", "startTime", "endTime", "place", "weather", "travel"], Keys(item));
        // The only activity of its date has no trip (feature 009 contracts/plan-schedule-api.md).
        Assert.Equal(JsonValueKind.Null, item.GetProperty("travel").ValueKind);

        var travel = body.GetProperty("travel");
        Assert.Equal(["maxDistanceKm", "tripsOverLimit"], Keys(travel));
        Assert.Equal(30, travel.GetProperty("maxDistanceKm").GetInt32());
        Assert.Equal(0, travel.GetProperty("tripsOverLimit").GetInt32());
        Assert.Equal("2026-11-12", item.GetProperty("date").GetString());
        Assert.False(string.IsNullOrEmpty(item.GetProperty("startTime").GetString()));
        Assert.False(string.IsNullOrEmpty(item.GetProperty("endTime").GetString()));

        var place1 = item.GetProperty("place");
        Assert.Equal(["name", "latitude", "longitude", "distanceKm", "area"], Keys(place1));

        var weather = item.GetProperty("weather");
        Assert.Equal(["temperatureC", "rainMmPerHour", "windMs", "isIndoor"], Keys(weather));
        Assert.False(weather.GetProperty("isIndoor").GetBoolean());
        Assert.Equal(18.0m, weather.GetProperty("temperatureC").GetDecimal());

        Assert.Empty(body.GetProperty("unscheduled").EnumerateArray());
    }

    [Fact]
    public async Task IndoorActivity_HasNullWeatherAndIsIndoorTrue()
    {
        var place = ScriptPlaceWithForecastAndPlaces();
        var museumId = await AddIndoorCategoryAsync("Schedule museum");

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[] { IndoorActivity(museumId) }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Single(scheduled);

        var weather = scheduled[0].GetProperty("weather");
        Assert.True(weather.GetProperty("isIndoor").GetBoolean());
        Assert.Equal(JsonValueKind.Null, weather.GetProperty("temperatureC").ValueKind);
        Assert.Equal(JsonValueKind.Null, weather.GetProperty("rainMmPerHour").ValueKind);
        Assert.Equal(JsonValueKind.Null, weather.GetProperty("windMs").ValueKind);
    }

    [Fact]
    public async Task ActivityWithNoMatchingPlaces_IsUnscheduledWithNoPlace()
    {
        var place = ScriptPlaceWithForecastAndNoPlaces();
        var kayakingId = await AddOutdoorCategoryAsync("Schedule no-place");

        var (status, body) = await PostAsync(new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[] { OutdoorActivity(kayakingId) }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Empty(body.GetProperty("scheduled").EnumerateArray());
        var unscheduled = body.GetProperty("unscheduled").EnumerateArray().ToList();
        Assert.Single(unscheduled);
        Assert.Equal(["activityName", "reason"], Keys(unscheduled[0]));
        Assert.Equal("noPlace", unscheduled[0].GetProperty("reason").GetString());
    }

    [Fact]
    public async Task OutOfDateSetup_GivesThePrefixedSetupKeys()
    {
        var place = ScriptPlaceWithForecastAndPlaces();
        var kayakingId = await AddOutdoorCategoryAsync("Schedule past");
        var calls = factory.Forecast.Calls;

        var (status, body) = await PostAsync(
            new
            {
                setup = new { locationId = place.Id, dates = new[] { "2026-11-10" }, maxTravelDistanceKm = 30 },
                activities = new object[] { OutdoorActivity(kayakingId) }
            },
            "2026-11-11T08:00:00Z");

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal(["setup.dates[0]"], ErrorKeys(body));
        Assert.Equal(calls, factory.Forecast.Calls);
    }

    // --- helpers ---

    private GeocodingPlace ScriptPlaceWithForecastAndPlaces()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 54.5 + (id % 100_000 / 1_000_000.0), 23.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [
                FakeMapPlacesClient.Element("node/1", place.Latitude, place.Longitude, ("name", "Slipway"), ("leisure", "slipway")),
                FakeMapPlacesClient.Element("node/2", place.Latitude, place.Longitude, ("name", "Muziejus"), ("tourism", "museum"))
            ]);
        return place;
    }

    private GeocodingPlace ScriptPlaceWithForecastAndNoPlaces()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.0 + (id % 100_000 / 1_000_000.0), 23.0, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(place.Latitude, place.Longitude, []);
        return place;
    }

    private static object OutdoorActivity(Guid categoryId) => new
    {
        categoryId,
        type = "Outdoor",
        durationHours = 2,
        requiresDaylight = true,
        maxWindMs = 8,
        maxRainMmPerHour = 0.5,
        minTemperatureC = 15,
        maxTemperatureC = 35
    };

    private static object IndoorActivity(Guid categoryId) => new
    {
        categoryId,
        type = "Indoor",
        durationHours = 2,
        requiresDaylight = false,
        maxWindMs = (double?)null,
        maxRainMmPerHour = (double?)null,
        minTemperatureC = (double?)null,
        maxTemperatureC = (double?)null
    };

    private Task<Guid> AddOutdoorCategoryAsync(string name) => AddCategoryAsync(new
    {
        name = PostgreSqlApiFactory.UniqueCategoryName(name),
        type = "Outdoor",
        defaultDurationHours = 2,
        requiresDaylight = true,
        maxWindMs = 8,
        maxRainMmPerHour = 0.5,
        minTemperatureC = 15,
        maxTemperatureC = 35,
        placeTags = "leisure=slipway"
    });

    private Task<Guid> AddIndoorCategoryAsync(string name) => AddCategoryAsync(new
    {
        name = PostgreSqlApiFactory.UniqueCategoryName(name),
        type = "Indoor",
        defaultDurationHours = 2,
        requiresDaylight = false,
        placeTags = "tourism=museum"
    });

    private async Task<Guid> AddCategoryAsync(object category)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", category);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(object body, string utcNow = Now)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(utcNow);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, body);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();

    private static List<string> ErrorKeys(JsonElement body) =>
        body.GetProperty("errors").EnumerateObject().Select(error => error.Name).ToList();
}
