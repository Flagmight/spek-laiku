using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;
using SpekLaiku.Api.Services;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The travel check in <c>POST /api/plan-schedule</c> (feature 009 contracts/plan-schedule-api.md), against the
/// fake location, weather and map data services. Since feature 008 every activity takes its whole suitable
/// period, so two activities only share a date when the day is split: a 12 m/s wind at 11:00 leaves the periods
/// 08:00–11:00 and 12:00–16:00. The first activity in plan order takes the longer afternoon period, so it is the
/// second stop of the day. Every test scripts its own place id and position, because the caches are keyed by
/// location.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanScheduleTravelTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-schedule";

    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    private const string PlanDate = "2026-11-12";

    /// <summary>About 1 km north or south, in degrees of latitude.</summary>
    private const double OneKmLatitude = 0.009;

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Fact]
    public async Task TwoActivitiesOnOneDate_SecondHasTheTripFromTheFirstPlace()
    {
        var location = ScriptLocation(splitDay: true, origin =>
        [
            Element("node/1", origin, +OneKmLatitude, "Parkas", "leisure", "park"),
            Element("node/2", origin, -OneKmLatitude, "Slipway", "leisure", "slipway")
        ]);
        var kayaking = await AddCategoryAsync("Travel kayaking", "leisure=slipway");
        var picnic = await AddCategoryAsync("Travel picnic", "leisure=park");

        var (status, body) = await PostAsync(location, maxTravelDistanceKm: 30, kayaking, picnic);

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Equal(2, scheduled.Count);

        // Chronological order: the picnic took 08:00–11:00, the kayaking 12:00–16:00.
        var first = scheduled[0];
        var second = scheduled[1];
        Assert.Equal("08:00", first.GetProperty("startTime").GetString());
        Assert.Equal("12:00", second.GetProperty("startTime").GetString());
        Assert.Equal(JsonValueKind.Null, first.GetProperty("travel").ValueKind);

        var travel = second.GetProperty("travel");
        Assert.Equal(["fromPlaceName", "distanceKm", "overLimit"], Keys(travel));
        Assert.Equal(first.GetProperty("place").GetProperty("name").GetString(), travel.GetProperty("fromPlaceName").GetString());
        Assert.Equal(ExpectedDistance(first, second), travel.GetProperty("distanceKm").GetDecimal());
        Assert.InRange(travel.GetProperty("distanceKm").GetDecimal(), 1.9m, 2.1m);
        Assert.False(travel.GetProperty("overLimit").GetBoolean());

        var summary = body.GetProperty("travel");
        Assert.Equal(30, summary.GetProperty("maxDistanceKm").GetInt32());
        Assert.Equal(0, summary.GetProperty("tripsOverLimit").GetInt32());
    }

    [Fact]
    public async Task ActivitiesOnDifferentDates_HaveNoTrip()
    {
        // Without the windy hour each activity needs the whole day, so the second one goes to the next date.
        var location = ScriptLocation(splitDay: false, origin =>
        [
            Element("node/1", origin, +OneKmLatitude, "Parkas", "leisure", "park"),
            Element("node/2", origin, -OneKmLatitude, "Slipway", "leisure", "slipway")
        ]);
        var kayaking = await AddCategoryAsync("Travel kayaking", "leisure=slipway");
        var picnic = await AddCategoryAsync("Travel picnic", "leisure=park");

        var (status, body) = await PostAsync(
            location, maxTravelDistanceKm: 30, [PlanDate, "2026-11-13"], kayaking, picnic);

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Equal(2, scheduled.Count);
        Assert.NotEqual(scheduled[0].GetProperty("date").GetString(), scheduled[1].GetProperty("date").GetString());
        Assert.All(scheduled, item => Assert.Equal(JsonValueKind.Null, item.GetProperty("travel").ValueKind));
        Assert.Equal(0, body.GetProperty("travel").GetProperty("tripsOverLimit").GetInt32());
    }

    [Fact]
    public async Task SetupWithoutAMaximum_UsesTheDefaultOf30()
    {
        var location = ScriptLocation(splitDay: false, origin =>
            [Element("node/1", origin, +OneKmLatitude, "Slipway", "leisure", "slipway")]);
        var kayaking = await AddCategoryAsync("Travel kayaking", "leisure=slipway");

        var (status, body) = await PostAsync(location, maxTravelDistanceKm: null, kayaking);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(30, body.GetProperty("travel").GetProperty("maxDistanceKm").GetInt32());
    }

    [Fact]
    public async Task NearestPlaceTooFar_AnotherListedPlaceWithinTheMaximumIsUsed()
    {
        // Within the 3 km search radius: the picnic's only place 2.5 km north; the slipway nearest to the
        // location 2.4 km south (about 4.9 km from the picnic) and another one 2.7 km north (about 0.2 km).
        var location = ScriptLocation(splitDay: true, origin =>
        [
            Element("node/1", origin, 2.5 * OneKmLatitude, "Parkas", "leisure", "park"),
            Element("node/2", origin, -2.4 * OneKmLatitude, "Pietų slipway", "leisure", "slipway"),
            Element("node/3", origin, 2.7 * OneKmLatitude, "Šiaurės slipway", "leisure", "slipway")
        ]);
        var kayaking = await AddCategoryAsync("Travel kayaking", "leisure=slipway");
        var picnic = await AddCategoryAsync("Travel picnic", "leisure=park");

        var (status, body) = await PostAsync(location, maxTravelDistanceKm: 3, kayaking, picnic);

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Equal(2, scheduled.Count);
        var first = scheduled[0];
        var second = scheduled[1];
        Assert.Equal("Parkas", first.GetProperty("place").GetProperty("name").GetString());

        // Not the nearest slipway, but the first listed one within 3 km of the picnic (spec FR-004).
        Assert.Equal("Šiaurės slipway", second.GetProperty("place").GetProperty("name").GetString());
        var travel = second.GetProperty("travel");
        Assert.Equal("Parkas", travel.GetProperty("fromPlaceName").GetString());
        Assert.Equal(ExpectedDistance(first, second), travel.GetProperty("distanceKm").GetDecimal());
        Assert.False(travel.GetProperty("overLimit").GetBoolean());
        Assert.Equal(0, body.GetProperty("travel").GetProperty("tripsOverLimit").GetInt32());
        // The time slots are the ones the scheduler gave (spec FR-009).
        Assert.Equal("08:00", first.GetProperty("startTime").GetString());
        Assert.Equal("12:00", second.GetProperty("startTime").GetString());
    }

    [Fact]
    public async Task NoListedPlaceWithinTheMaximum_NearestPlaceIsKeptAndTheTripIsFlagged()
    {
        // Within the 1 km search radius: the picnic's place 0.9 km north; both slipways south, so each is more
        // than 1 km from the picnic.
        var location = ScriptLocation(splitDay: true, origin =>
        [
            Element("node/1", origin, 0.9 * OneKmLatitude, "Parkas", "leisure", "park"),
            Element("node/2", origin, -0.8 * OneKmLatitude, "Artimas slipway", "leisure", "slipway"),
            Element("node/3", origin, -0.85 * OneKmLatitude, "Tolimas slipway", "leisure", "slipway")
        ]);
        var kayaking = await AddCategoryAsync("Travel kayaking", "leisure=slipway");
        var picnic = await AddCategoryAsync("Travel picnic", "leisure=park");

        var (status, body) = await PostAsync(location, maxTravelDistanceKm: 1, kayaking, picnic);

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = body.GetProperty("scheduled").EnumerateArray().ToList();
        Assert.Equal(2, scheduled.Count);

        // The flagged activity stays scheduled at its nearest place; no new unscheduled reason (spec FR-005).
        Assert.Empty(body.GetProperty("unscheduled").EnumerateArray());
        var second = scheduled[1];
        Assert.Equal("Artimas slipway", second.GetProperty("place").GetProperty("name").GetString());
        var travel = second.GetProperty("travel");
        Assert.Equal(ExpectedDistance(scheduled[0], second), travel.GetProperty("distanceKm").GetDecimal());
        Assert.True(travel.GetProperty("distanceKm").GetDecimal() > 1m);
        Assert.True(travel.GetProperty("overLimit").GetBoolean());

        var summary = body.GetProperty("travel");
        Assert.Equal(1, summary.GetProperty("maxDistanceKm").GetInt32());
        Assert.Equal(1, summary.GetProperty("tripsOverLimit").GetInt32());
    }

    // --- helpers ---

    private GeocodingPlace ScriptLocation(bool splitDay, Func<GeocodingPlace, IReadOnlyList<MapElement>> elements)
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var location = new GeocodingPlace(id, "Testinė", 55.6 + (id % 100_000 / 1_000_000.0), 24.1, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(location);

        var forecast = FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20));
        if (splitDay)
        {
            forecast = FakeForecastClient.WithHour(forecast, DateOnly.Parse(PlanDate), 11, 18.0, 0.0, 12.0);
        }

        factory.Forecast.Script(location.Latitude, location.Longitude, forecast);
        factory.MapPlaces.Script(location.Latitude, location.Longitude, elements(location));
        return location;
    }

    private static MapElement Element(
        string key, GeocodingPlace origin, double latitudeOffset, string name, string tagKey, string tagValue) =>
        FakeMapPlacesClient.Element(
            key, origin.Latitude + latitudeOffset, origin.Longitude, ("name", name), (tagKey, tagValue));

    /// <summary>The straight-line distance between the two places as the response shows them (spec SC-003).</summary>
    private static decimal ExpectedDistance(JsonElement from, JsonElement to)
    {
        var a = from.GetProperty("place");
        var b = to.GetProperty("place");
        return GeoDistance.RoundToTenth(GeoDistance.Kilometres(
            a.GetProperty("latitude").GetDouble(),
            a.GetProperty("longitude").GetDouble(),
            b.GetProperty("latitude").GetDouble(),
            b.GetProperty("longitude").GetDouble()));
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

    private async Task<Guid> AddCategoryAsync(string name, string placeTags)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName(name),
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }

    private Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(
        GeocodingPlace location, int? maxTravelDistanceKm, params Guid[] categoryIds) =>
        PostAsync(location, maxTravelDistanceKm, [PlanDate], categoryIds);

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(
        GeocodingPlace location, int? maxTravelDistanceKm, string[] dates, params Guid[] categoryIds)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now);
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, new
        {
            setup = new { locationId = location.Id, dates, maxTravelDistanceKm },
            activities = categoryIds.Select(OutdoorActivity).ToArray()
        });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static List<string> Keys(JsonElement element) =>
        element.EnumerateObject().Select(property => property.Name).ToList();
}
