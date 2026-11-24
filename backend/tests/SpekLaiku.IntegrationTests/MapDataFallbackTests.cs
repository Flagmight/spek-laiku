using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text;
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
/// The fallback map data server (feature 017 User Story 1, spec FR-009 to FR-014): when the main server fails, the
/// same request goes to the fallback before any error is shown, the user is not told which server answered, and
/// each failed attempt is logged once with its role. Every test uses its own place id and position, because places
/// are reused per location.
/// </summary>
[Collection(PostgreSqlCollection.Name)]
public class MapDataFallbackTests(PostgreSqlApiFactory factory)
{
    private const string PlacesPath = "/api/plan-places";
    private const string SchedulePath = "/api/plan-schedule";
    private const string FallbackAddress = "https://fallback.example.test/";

    // 14:20 on 2026-11-10 in Vilnius (UTC+2).
    private const string Now = "2026-11-10T12:20:00Z";

    private static readonly DateOnly Today = new(2026, 11, 10);

    [Fact]
    public async Task PlacesStep_MainFails_ShowsTheFallbacksPlaces()
    {
        var place = ScriptPlaceWithMuseums();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.UnexpectedStatus, MapDataServerRole.Main);
        var categoryId = await AddCategoryAsync("Indoor");
        var (mainCalls, fallbackCalls) = RoleCalls();

        await using var host = WithFallback();
        var (status, body) = await PostAsync(host, PlacesPath, PlacesRequest(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal("14:20", body.GetProperty("updatedAt").GetString());
        var places = body.GetProperty("categories")[0].GetProperty("places").EnumerateArray()
            .Select(found => found.GetProperty("name").GetString())
            .ToList();
        Assert.Equal(["Muziejus 1", "Muziejus 2", "Muziejus 3"], places.Order());
        Assert.Equal((mainCalls + 1, fallbackCalls + 1), RoleCalls());
    }

    [Fact]
    public async Task ScheduleStep_MainFails_UsesTheFallbacksPlaces()
    {
        var place = ScriptPlaceWithMuseums();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Timeout, MapDataServerRole.Main);
        var categoryId = await AddCategoryAsync("Indoor");

        await using var host = WithFallback();
        var (status, body) = await PostAsync(host, SchedulePath, new
        {
            setup = new { locationId = place.Id, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
            activities = new object[] { IndoorActivity(categoryId) }
        });

        Assert.Equal(HttpStatusCode.OK, status);
        var scheduled = Assert.Single(body.GetProperty("scheduled").EnumerateArray());
        Assert.StartsWith("Muziejus", scheduled.GetProperty("place").GetProperty("name").GetString());
    }

    [Fact]
    public async Task BothFail_ReturnTheExistingMapDataError()
    {
        var place = ScriptPlaceWithMuseums();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Timeout, MapDataServerRole.Main);
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Network, MapDataServerRole.Fallback);
        var categoryId = await AddCategoryAsync("Indoor");
        var (mainCalls, fallbackCalls) = RoleCalls();

        await using var host = WithFallback();
        var (status, body) = await PostAsync(host, PlacesPath, PlacesRequest(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal("places", body.GetProperty("service").GetString());
        Assert.Equal("The map data service is unavailable. No places are shown.", body.GetProperty("detail").GetString());
        Assert.False(body.TryGetProperty("categories", out _));
        Assert.Equal((mainCalls + 1, fallbackCalls + 1), RoleCalls());
    }

    [Fact]
    public async Task MainAnswers_FallbackIsNotContacted()
    {
        var place = ScriptPlaceWithMuseums();
        var categoryId = await AddCategoryAsync("Indoor");
        var (mainCalls, fallbackCalls) = RoleCalls();

        await using var host = WithFallback();
        var (status, _) = await PostAsync(host, PlacesPath, PlacesRequest(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal((mainCalls + 1, fallbackCalls), RoleCalls());
    }

    [Fact]
    public async Task ResponseDoesNotSayWhichServerAnswered()
    {
        var place = ScriptPlaceWithMuseums();
        factory.MapPlaces.ScriptFailure(place.Latitude, place.Longitude, FailureKind.Network, MapDataServerRole.Main);
        var categoryId = await AddCategoryAsync("Indoor");

        await using var host = WithFallback();
        using var client = CreateHttpsClient(host);
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        using var response = await client.PostAsJsonAsync(PlacesPath, PlacesRequest(place.Id, categoryId));
        var text = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("fallback", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("example.test", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("overpass", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task EachFailedAttempt_IsLoggedWithItsRole()
    {
        // The real Overpass client behind a fake network that answers 502 for both servers, so the client's own
        // warnings are what is recorded.
        var place = ScriptPlaceWithMuseums();
        var categoryId = await AddCategoryAsync("Indoor");
        var logs = new CapturingLoggerProvider();
        var handler = new BadGatewayHandler();

        await using var host = WithFallback(builder =>
        {
            builder.ConfigureLogging(logging => logging
                .AddProvider(logs)
                .AddFilter<CapturingLoggerProvider>(null, LogLevel.Trace));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<IMapPlacesClient>();
                services.AddSingleton<IMapPlacesClient>(provider =>
                {
                    var httpClient = new HttpClient(handler);
                    OverpassMapPlacesClient.Configure(httpClient);
                    return new OverpassMapPlacesClient(
                        httpClient,
                        provider.GetRequiredService<ILogger<OverpassMapPlacesClient>>());
                });
            });
        });
        var (status, _) = await PostAsync(host, PlacesPath, PlacesRequest(place.Id, categoryId));

        Assert.Equal(HttpStatusCode.ServiceUnavailable, status);
        Assert.Equal(["fallback.example.test", "overpass-api.de"], handler.Hosts.Order());
        var failures = logs.Entries.Where(entry => entry.Contains("Map data service failed")).ToList();
        Assert.Equal(2, failures.Count);
        Assert.Single(failures, entry => entry.Contains("on the main server"));
        Assert.Single(failures, entry => entry.Contains("on the fallback server"));
        foreach (var failure in failures)
        {
            Assert.Contains("Warning", failure);
            Assert.DoesNotContain("example.test", failure);
            Assert.DoesNotContain("overpass-api.de", failure);
            Assert.DoesNotContain(place.Latitude.ToString("F3", CultureInfo.InvariantCulture), failure);
            Assert.DoesNotContain(place.Id.ToString(CultureInfo.InvariantCulture), failure);
            Assert.DoesNotContain("museum", failure);
        }
    }

    // --- helpers ---

    private (int Main, int Fallback) RoleCalls() =>
        (factory.MapPlaces.CallsFor(MapDataServerRole.Main), factory.MapPlaces.CallsFor(MapDataServerRole.Fallback));

    private WebApplicationFactory<Program> WithFallback(Action<IWebHostBuilder>? configure = null) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("MapData:FallbackServer", FallbackAddress);
            configure?.Invoke(builder);
        });

    private static HttpClient CreateHttpsClient(WebApplicationFactory<Program> host) =>
        host.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

    // Positions of their own (56.x, 24.5), so no other test's places or failures apply.
    private GeocodingPlace ScriptPlaceWithMuseums()
    {
        var id = Random.Shared.NextInt64(100_000_000, 999_999_999);
        var place = new GeocodingPlace(id, "Testinė", 56.0 + (id % 100_000 / 1_000_000.0), 24.5, "LT", "Kaunas", null);
        factory.Geocoding.ScriptPlace(place);
        factory.Forecast.Script(
            place.Latitude,
            place.Longitude,
            FakeForecastClient.Fill(Today, 7, 18.0, 0.0, 3.0, new TimeOnly(7, 42), new TimeOnly(16, 20)));
        factory.MapPlaces.Script(
            place.Latitude,
            place.Longitude,
            [
                Museum("node/1", "Muziejus 1", place),
                Museum("node/2", "Muziejus 2", place),
                Museum("node/3", "Muziejus 3", place)
            ]);
        return place;
    }

    private static MapElement Museum(string key, string name, GeocodingPlace place) =>
        FakeMapPlacesClient.Element(key, place.Latitude, place.Longitude, ("name", name), ("tourism", "museum"));

    private static object PlacesRequest(long locationId, Guid categoryId) => new
    {
        setup = new { locationId, dates = new[] { "2026-11-12" }, maxTravelDistanceKm = 30 },
        activities = new object[] { IndoorActivity(categoryId) }
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

    private async Task<Guid> AddCategoryAsync(string type)
    {
        using var administrator = await factory.CreateSignedInClientAsync("Administrator");
        using var response = await administrator.PostAsJsonAsync("/api/admin/categories", new
        {
            name = PostgreSqlApiFactory.UniqueCategoryName("Second server museum"),
            type,
            defaultDurationHours = 2,
            requiresDaylight = false,
            placeTags = "tourism=museum"
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ActivityCategoryResponse>())!.Id;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> PostAsync(
        WebApplicationFactory<Program> host,
        string path,
        object body)
    {
        factory.Clock.UtcNow = DateTimeOffset.Parse(Now, CultureInfo.InvariantCulture);
        using var client = CreateHttpsClient(host);
        using var response = await client.PostAsJsonAsync(path, body);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }

    /// <summary>Answers every request with 502, as a broken Overpass server would, and records each host asked.</summary>
    private sealed class BadGatewayHandler : HttpMessageHandler
    {
        public List<string> Hosts { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            lock (Hosts)
            {
                Hosts.Add(request.RequestUri!.Host);
            }

            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadGateway)
            {
                Content = new StringContent("{}", Encoding.UTF8, "application/json")
            });
        }
    }
}
