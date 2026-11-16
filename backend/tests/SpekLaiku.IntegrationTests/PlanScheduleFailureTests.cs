using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-schedule</c> when a service fails (spec FR-009, FR-010; contracts/plan-schedule-api.md):
/// the <c>503</c> answer names the failed service. Every test uses its own place id and position, because
/// forecasts and places are cached per location.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanScheduleFailureTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-schedule";

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task WeatherServiceFailure_Answers503(FailureKind kind)
    {
        var place = ScriptPlace();
        factory.Forecast.ScriptFailure(place.Latitude, place.Longitude, kind);
        var categoryId = await AddCategoryAsync();

        var (status, body) = await PostAsync(place.Id, categoryId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("forecast", body.GetProperty("service").GetString());
        Assert.False(body.TryGetProperty("scheduled", out _));
    }

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task MapDataServiceFailure_Answers503(FailureKind kind)
    {
        var place = ScriptPlaceWithForecast();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, kind);
        var categoryId = await AddCategoryAsync();

        var (status, body) = await PostAsync(place.Id, categoryId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("places", body.GetProperty("service").GetString());
        Assert.False(body.TryGetProperty("scheduled", out _));
    }

    [Fact]
    public async Task LocationLookupFailure_Answers503WithoutReachingOtherServices()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        factory.Geocoding.ScriptGetFailure(id, FailureKind.Timeout);
        var categoryId = await AddCategoryAsync();
        var forecastCalls = factory.Forecast.Calls;
        var mapCalls = factory.MapPlaces.Calls;

        var (status, body) = await PostAsync(id, categoryId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("locationSearch", body.GetProperty("service").GetString());
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
        Assert.Equal(mapCalls, factory.MapPlaces.Calls);
    }

    // --- helpers ---

    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.5 + (id % 100_000 / 1_000_000.0), 24.0, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        return place;
    }

    private GeocodingPlace ScriptPlaceWithForecast()
    {
        var place = ScriptPlace();
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        return place;
    }

    private async Task<Guid> AddCategoryAsync()
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Schedule failure"),
            type = "Outdoor",
            defaultDurationHours = 2,
            requiresDaylight = true,
            maxWindMs = 8,
            maxRainMmPerHour = 0.5,
            minTemperatureC = 15,
            maxTemperatureC = 35,
            placeTags = "leisure=slipway"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(long locationId, Guid categoryId)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, new
        {
            setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[]
            {
                new
                {
                    categoryId,
                    type = "Outdoor",
                    durationHours = 2,
                    requiresDaylight = true,
                    maxWindMs = 8,
                    maxRainMmPerHour = 0.5,
                    minTemperatureC = 15,
                    maxTemperatureC = 35
                }
            }
        });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }
}
