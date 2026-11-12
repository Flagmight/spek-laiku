using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using SpekLaiku.Api;
using SpekLaiku.Api.Clients;
using SpekLaiku.Api.DTOs.Responses;

namespace SpekLaiku.IntegrationTests;

/// <summary>
/// The plan setup request limit (feature 004 spec FR-027, research section 14), which forecast and place
/// requests share (feature 006 spec FR-008, feature 007 spec FR-011). Each test builds its own host with a low
/// limit and its own fake location, weather and map data services, so the shared host's high limit cannot
/// hide a mistake; the database is the collection's.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class PlanSetupRateLimitTests(PostgreSqlApiFactory factory)
{
    [Fact]
    public async Task FourthRequest_IsRefusedWithTheContractAnswer()
    {
        var geocoding = new FakeGeocodingClient();
        await using var host = CreateHost(geocoding, permitLimit: "3");
        using var client = CreateClient(host);

        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await CheckAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        using var refused = await SearchAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        using var body = JsonDocument.Parse(await refused.Content.ReadAsStringAsync());
        Assert.Equal("Too many requests.", body.RootElement.GetProperty("title").GetString());
        Assert.Equal(
            "Too many requests. Wait a minute and try again.",
            body.RootElement.GetProperty("detail").GetString());
        Assert.True(refused.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.Equal(2, geocoding.SearchCalls);
    }

    [Fact]
    public async Task CheckOverTheLimit_IsRefusedToo()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "3");
        using var client = CreateClient(host);
        for (var request = 0; request < 3; request++)
        {
            using var allowed = await SearchAsync(client);
        }

        using var refused = await CheckAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
    }

    [Fact]
    public async Task VisitorAndSignedInUserFromOneAddress_ShareTheLimit()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "3");
        using var visitor = CreateClient(host);
        var user = await factory.CreateUserAsync();
        using var signedIn = CreateClient(host);
        using var signIn = await signedIn.PostAsync(
            $"{TestSignInStartupFilter.Path}?email={Uri.EscapeDataString(user.Email!)}", content: null);
        Assert.Equal(HttpStatusCode.NoContent, signIn.StatusCode);

        using var first = await SearchAsync(visitor);
        using var second = await SearchAsync(signedIn);
        using var third = await SearchAsync(visitor);
        using var refused = await SearchAsync(signedIn);

        Assert.Equal(HttpStatusCode.OK, third.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
    }

    [Fact]
    public async Task LimitOfZero_StopsTheApplicationFromStarting()
    {
        await using var host = CreateHost(new FakeGeocodingClient(), permitLimit: "0");

        var exception = Record.Exception(() => host.CreateClient());

        Assert.NotNull(exception);
        Assert.Contains("must be positive", Describe(exception));
    }

    [Fact]
    public async Task ForecastRequests_ShareTheLimitWithSearchesAndChecks()
    {
        var geocoding = new FakeGeocodingClient();
        var forecast = new FakeForecastClient();
        var (placeId, categoryId) = await ScriptForecastPlanAsync(geocoding, forecast);
        await using var host = CreateHost(geocoding, permitLimit: "3", forecast);
        using var client = CreateClient(host);

        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await CheckAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ForecastAsync(client, placeId, categoryId)).StatusCode);
        var lookups = geocoding.GetCalls;
        var forecasts = forecast.Calls;
        using var refused = await ForecastAsync(client, placeId, categoryId);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        using var body = JsonDocument.Parse(await refused.Content.ReadAsStringAsync());
        Assert.Equal("Too many requests.", body.RootElement.GetProperty("title").GetString());
        Assert.Equal(
            "Too many requests. Wait a minute and try again.",
            body.RootElement.GetProperty("detail").GetString());
        Assert.True(refused.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.Equal(lookups, geocoding.GetCalls);
        Assert.Equal(forecasts, forecast.Calls);
    }

    [Fact]
    public async Task ThreeForecastRequests_UseUpTheLimitForASearch()
    {
        var geocoding = new FakeGeocodingClient();
        var forecast = new FakeForecastClient();
        var (placeId, categoryId) = await ScriptForecastPlanAsync(geocoding, forecast);
        await using var host = CreateHost(geocoding, permitLimit: "3", forecast);
        using var client = CreateClient(host);
        for (var request = 0; request < 3; request++)
        {
            using var allowed = await ForecastAsync(client, placeId, categoryId);
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        using var refused = await SearchAsync(client);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal(0, geocoding.SearchCalls);
    }

    [Fact]
    public async Task PlaceRequests_ShareTheLimitWithSearchesChecksAndForecasts()
    {
        var geocoding = new FakeGeocodingClient();
        var forecast = new FakeForecastClient();
        var mapPlaces = new FakeMapPlacesClient();
        var logs = new CapturingLoggerProvider();
        var (placeId, categoryId) = await ScriptForecastPlanAsync(geocoding, forecast, mapPlaces);
        await using var host = CreateHost(geocoding, permitLimit: "4", forecast, mapPlaces, logs);
        using var client = CreateClient(host);

        Assert.Equal(HttpStatusCode.OK, (await SearchAsync(client)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await CheckAsync(client)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ForecastAsync(client, placeId, categoryId)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await PlacesAsync(client, placeId, categoryId)).StatusCode);
        var lookups = geocoding.GetCalls;
        var searches = mapPlaces.Calls;
        using var refused = await PlacesAsync(client, placeId, categoryId);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        using var body = JsonDocument.Parse(await refused.Content.ReadAsStringAsync());
        Assert.Equal(
            "Too many requests. Wait a minute and try again.",
            body.RootElement.GetProperty("detail").GetString());
        Assert.True(refused.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.Equal(lookups, geocoding.GetCalls);
        Assert.Equal(searches, mapPlaces.Calls);
        Assert.DoesNotContain(logs.Entries, entry => entry.Contains("service failed"));
    }

    [Fact]
    public async Task ThreePlaceRequests_UseUpTheLimitForAForecast()
    {
        var geocoding = new FakeGeocodingClient();
        var forecast = new FakeForecastClient();
        var mapPlaces = new FakeMapPlacesClient();
        var (placeId, categoryId) = await ScriptForecastPlanAsync(geocoding, forecast, mapPlaces);
        await using var host = CreateHost(geocoding, permitLimit: "3", forecast, mapPlaces);
        using var client = CreateClient(host);
        for (var request = 0; request < 3; request++)
        {
            using var allowed = await PlacesAsync(client, placeId, categoryId);
            Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
        }

        using var refused = await ForecastAsync(client, placeId, categoryId);

        Assert.Equal(HttpStatusCode.TooManyRequests, refused.StatusCode);
        Assert.Equal(0, forecast.Calls);
    }

    // The forecast and map data fakes are optional so the older tests stay as they were; new ones are used
    // when none is passed, so this host never reaches the live weather or map data service.
    private WebApplicationFactory<Program> CreateHost(
        FakeGeocodingClient geocoding,
        string permitLimit,
        FakeForecastClient? forecast = null,
        FakeMapPlacesClient? mapPlaces = null,
        CapturingLoggerProvider? logs = null) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("RateLimiting:PlanSetup:PermitLimit", permitLimit);
            if (logs is not null)
            {
                builder.ConfigureLogging(logging => logging
                    .AddProvider(logs)
                    .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace));
            }

            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingClient>();
                services.AddSingleton<IGeocodingClient>(geocoding);
                services.RemoveAll<IForecastClient>();
                services.AddSingleton<IForecastClient>(forecast ?? new FakeForecastClient());
                services.RemoveAll<IMapPlacesClient>();
                services.AddSingleton<IMapPlacesClient>(mapPlaces ?? new FakeMapPlacesClient());
            });
        });

    /// <summary>
    /// A place and its forecast in this host's fakes, and an Outdoor category in the shared database, so a
    /// forecast request is valid. The clock is set to 14:20 on 2026-11-10 in Vilnius.
    /// </summary>
    private async Task<(long PlaceId, Guid CategoryId)> ScriptForecastPlanAsync(
        FakeGeocodingClient geocoding,
        FakeForecastClient forecast,
        FakeMapPlacesClient? mapPlaces = null)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse("2026-11-10T12:20:00Z");
        var place = new GeocodingPlace(Random.Shared.NextInt64(100_000_000, 999_999_999), "Testinė", 54.5, 24.5, "LT", "Kaunas", null);
        geocoding.ScriptPlace(place);
        forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(new DateOnly(2026, 11, 10), 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        mapPlaces?.Script(place.Latitude, place.Longitude, []);

        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Limit forecast"),
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
        var created = await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>();
        return (place.Id, created!.Id);
    }

    private static Task<HttpResponseMessage> ForecastAsync(HttpClient client, long placeId, Guid categoryId) =>
        client.PostAsJsonAsync("/api/plan-forecast", PlanBody(placeId, categoryId));

    private static Task<HttpResponseMessage> PlacesAsync(HttpClient client, long placeId, Guid categoryId) =>
        client.PostAsJsonAsync("/api/plan-places", PlanBody(placeId, categoryId));

    // The same body for both step 3 requests.
    private static object PlanBody(long placeId, Guid categoryId) =>
        new
        {
            setup = new { locationId = placeId, dates = new[] { "2026-11-11" }, maxTravelDistanceKm = 30 },
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
        };

    private static HttpClient CreateClient(WebApplicationFactory<Program> host) =>
        host.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("https://localhost"),
            AllowAutoRedirect = false
        });

    private static Task<HttpResponseMessage> SearchAsync(HttpClient client) =>
        client.GetAsync($"/api/locations?query=Limit{Guid.NewGuid():N}");

    private static Task<HttpResponseMessage> CheckAsync(HttpClient client) =>
        client.PostAsJsonAsync("/api/plan-setup/check", new { locationId = 1, dates = new[] { "2026-11-07" } });

    // The validation message may be wrapped by the host, so every inner exception is read.
    private static string Describe(Exception exception)
    {
        var messages = new List<string>();
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            messages.Add(current.Message);
            if (current is AggregateException aggregate)
            {
                messages.AddRange(aggregate.InnerExceptions.Select(inner => inner.Message));
            }
        }

        return string.Join(" | ", messages);
    }
}
