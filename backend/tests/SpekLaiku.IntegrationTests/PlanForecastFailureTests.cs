using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// <c>POST /api/plan-forecast</c> when a service fails (spec FR-006, contracts/plan-forecast-api.md): the
/// <c>503</c> answer names the service, and failures are not cached. Every test uses its own place id and
/// position, because answers are cached per location.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanForecastFailureTests(PostgreSqlApiFactory factory)
{
    private const string Path = "/api/plan-forecast";

    [Theory]
    [InlineData(FailureKind.Timeout)]
    [InlineData(FailureKind.Network)]
    [InlineData(FailureKind.UnexpectedStatus)]
    [InlineData(FailureKind.InvalidResponse)]
    public async Task WeatherServiceFailure_Answers503ForTheForecast(FailureKind kind)
    {
        var place = ScriptPlace();
        factory.Forecast.ScriptFailure(place.Latitude, place.Longitude, kind);

        var (status, body) = await PostAsync(place.Id, await AddCategoryAsync());

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("forecast", body.GetProperty("service").GetString());
        Assert.Equal("The weather service is unavailable. No forecast is shown.", body.GetProperty("detail").GetString());
        Assert.False(body.TryGetProperty("days", out _));
    }

    [Fact]
    public async Task LocationLookupFailure_Answers503ForTheLocationSearchWithoutAskingForTheForecast()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        factory.Geocoding.ScriptGetFailure(id, FailureKind.Timeout);
        var categoryId = await AddCategoryAsync();
        var forecastCalls = factory.Forecast.Calls;

        var (status, body) = await PostAsync(id, categoryId);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("locationSearch", body.GetProperty("service").GetString());
        Assert.Equal(forecastCalls, factory.Forecast.Calls);
    }

    [Fact]
    public async Task FailureIsNotCached_TheNextRequestAsksAgain()
    {
        var place = ScriptPlace();
        factory.Forecast.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Timeout);
        var categoryId = await AddCategoryAsync();
        var (failed, _) = await PostAsync(place.Id, categoryId);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed);

        factory.Forecast.ScriptRecovery(place.Latitude, place.Longitude);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(new DateOnly(2026, 11, 10), 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        var calls = factory.Forecast.Calls;
        var (status, _) = await PostAsync(place.Id, categoryId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(calls + 1, factory.Forecast.Calls);
    }

    private GeocodingPlace ScriptPlace()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 55.0 + (id % 100_000 / 1_000_000.0), 24.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        return place;
    }

    private async Task<Guid> AddCategoryAsync()
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Forecast failure"),
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
        // 14:20 on 2026-11-10 in Vilnius.
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
        using var client = factory.CreateHttpsClient();
        using var response = await client.PostAsJsonAsync(Path, new
        {
            setup = new { locationId, dates = new[] { "2026-11-11" }, maxTravelDistanceKm = 30 },
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
