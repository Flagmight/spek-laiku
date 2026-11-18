using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// Generates schedules through <c>POST /api/plan-schedule</c> for the saved plan tests (feature 010), against the
/// fake location, weather and map data services, as <see cref="PlanScheduleEndpointTests"/> does. Every plan
/// scripts its own place, because the forecast and places caches are keyed by location.
/// </summary>
internal sealed class ScheduleScenario(PostgreSqlApiFactory factory)
{
    // 14:20 on 2026-11-10 in Vilnius (UTC+2); the plan date is two days later.
    public static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
    public const string PlanDate = "2026-11-12";

    private static readonly DateOnly Today = new(2026, 11, 10);

    /// <summary>One indoor activity with a place, which is always scheduled, so a schedule id is returned.</summary>
    public Task<object> IndoorPlanAsync() => PlanAsync(withPlaces: true);

    /// <summary>One indoor activity that finds no place, so nothing is scheduled.</summary>
    public Task<object> NothingScheduledPlanAsync() => PlanAsync(withPlaces: false);

    /// <summary>Posts the plan with the clock at <see cref="Now"/> and returns the 200 response body.</summary>
    public async Task<JsonElement> GenerateAsync(HttpClient client, object plan)
    {
        factory.Clock.UtcNow = Now;
        using var response = await client.PostAsJsonAsync("/api/plan-schedule", plan);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.Clone();
    }

    /// <summary>Generates an indoor plan and returns its <c>generatedScheduleId</c>.</summary>
    public async Task<Guid> GenerateIdAsync(HttpClient client)
    {
        var body = await GenerateAsync(client, await IndoorPlanAsync());
        return body.GetProperty("generatedScheduleId").GetGuid();
    }

    private async Task<object> PlanAsync(bool withPlaces)
    {
        var place = ScriptPlace(withPlaces);
        var categoryId = await AddIndoorCategoryAsync();

        return new
        {
            setup = new { locationId = place.Id, dates = new[] { PlanDate }, maxTravelDistanceKm = 30 },
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
    }

    private GeocodingPlace ScriptPlace(bool withPlaces)
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 24.0, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            withPlaces
                ? [FakeMapPlacesClient.Element("node/2", place.Latitude, place.Longitude, ("name", "Muziejus"), ("tourism", "museum"))]
                : []);
        return place;
    }

    private async Task<Guid> AddIndoorCategoryAsync()
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Saved museum"),
            type = "Indoor",
            defaultDurationHours = 2,
            requiresDaylight = false,
            placeTags = "tourism=museum"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }
}
