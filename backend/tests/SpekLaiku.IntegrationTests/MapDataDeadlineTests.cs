using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The 9-second deadline of place and schedule requests (feature 017 User Story 3, spec FR-007; research section
/// 4). The fake location and weather services move the factory's clock as if they took time, so no test waits.
/// Every test uses its own place id and position, because places, locations and forecasts are reused.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class MapDataDeadlineTests(PostgreSqlApiFactory factory)
{
    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Fact]
    public async Task ScheduleStep_ForecastUsesTheTime_MapDataIsNotContactedAndTheMapDataErrorIsShown()
    {
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync();
        var mapCalls = factory.MapPlaces.Calls;

        var (status, body) = await PostWhileAsync(
            () => factory.Forecast.BeforeAnswer = () => factory.Clock.UtcNow += TimeSpan.FromSeconds(8.5),
            "/api/plan-schedule",
            Request(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("places", body.GetProperty("service").GetString());
        Assert.Equal("The map data service is unavailable. No places are shown.", body.GetProperty("detail").GetString());
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    [Fact]
    public async Task PlacesStep_LocationLookupUsesFiveSeconds_MapDataStillGetsTheRest()
    {
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync();
        var mapCalls = factory.MapPlaces.Calls;

        var (status, body) = await PostWhileAsync(
            () => factory.Geocoding.BeforeAnswer = () => factory.Clock.UtcNow += TimeSpan.FromSeconds(5),
            "/api/plan-places",
            Request(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.OK, status);
        var names = body.GetProperty("categories")[0].GetProperty("places").EnumerateArray()
            .Select(found => found.GetProperty("name").GetString());
        Assert.Equal(["Muziejus"], names);
        Assert.Equal(mapCalls + 1, factory.MapPlaces.Calls);
    }

    [Fact]
    public async Task ScheduleStep_LookupAndForecastLeaveEnoughTime_TheScheduleUsesThePlaces()
    {
        var place = ScriptPlace();
        var categoryId = await AddCategoryAsync();

        var (status, body) = await PostWhileAsync(
            () =>
            {
                factory.Geocoding.BeforeAnswer = () => factory.Clock.UtcNow += TimeSpan.FromSeconds(3);
                factory.Forecast.BeforeAnswer = () => factory.Clock.UtcNow += TimeSpan.FromSeconds(3);
            },
            "/api/plan-schedule",
            Request(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = Assert.Single(body.GetProperty("scheduled").EnumerateArray());
        Assert.Equal("Muziejus", scheduled.GetProperty("place").GetProperty("name").GetString());
    }

    // --- helpers ---

    // Sets the hooks for one request, and always restores the clock and clears the hooks afterwards, because the
    // fakes and the clock are shared by the whole test collection.
    private async Task<(HttpStatusCode Status, JsonElement Body)> PostWhileAsync(
        Action setHooks,
        string path,
        object request)
    {
        var start = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        factory.Clock.UtcNow = start;
        try
        {
            setHooks();
            using var client = factory.CreateHttpsClient();
            using var response = await client.PostAsJsonAsync(path, request);
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            return (response.StatusCode, document.RootElement.Clone());
        }
        finally
        {
            factory.Geocoding.BeforeAnswer = null;
            factory.Forecast.BeforeAnswer = null;
            factory.Clock.UtcNow = start;
        }
    }

    // Positions of their own (57.x, 25.5), so no other test's places, forecasts or failures apply.
    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 57.0 + (id % 100_000 / 1_000_000.0), 25.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [FakeMapPlacesClient.Element("node/1", place.Latitude, place.Longitude, ("name", "Muziejus"), ("tourism", "museum"))]);
        return place;
    }

    private static object Request(long locationId, Guid categoryId) => new
    {
        setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
        activities = new object[]
        {
            new
            {
                categoryId,
                type = "Indoor",
                durationHours = 2,
                requiresDaylight = false,
                maxWindMs = (double?)null,
                maxRainMmPerHour = (double?)null,
                minTemperatureC = (double?)null,
                maxTemperatureC = (double?)null
            }
        }
    };

    private async Task<Guid> AddCategoryAsync()
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Deadline museum"),
            type = "Indoor",
            defaultDurationHours = 2,
            requiresDaylight = false,
            placeTags = "tourism=museum"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }
}
